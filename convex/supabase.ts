// SERVER-ONLY. This file lives in convex/, so it only ever runs inside Convex
// functions. Never import it from src/ (browser code). It is the single path
// from the app to Supabase, and it is the only place the service-role key is read.
//
// Current identity chain (documented on purpose):
//   Convex Auth user  ->  "convex:<users._id>"  ->  evara_customers.external_auth_id  ->  evara_customers.id
//
// The customer identity ALWAYS comes from the verified Convex session
// (getAuthUserId). Nothing the browser sends is ever treated as a customer id.
import { getAuthUserId } from "@convex-dev/auth/server"
import type { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"

export const EXTERNAL_ID_PREFIX = "convex:"
const REQUEST_TIMEOUT_MS = 10_000

// Placeholder business value — tune freely, this is not tied to any other logic.
const WELCOME_BONUS_COINS = 500

export type ApiError = { ok: false; code: string; message: string; traceId: string }
export type CustomerContext = { customerId: string; status: string; referralCode: string; username: string | null }

export function newTraceId(): string {
  return crypto.randomUUID()
}

export function externalIdFor(convexUserId: string): string {
  return `${EXTERNAL_ID_PREFIX}${convexUserId}`
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required Convex environment variable: ${name}`)
  return value
}

/** Structured log line. Never pass secrets or personal data in `data`. */
export function logEvent(traceId: string, op: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ src: "convex.supabase", trace_id: traceId, op, ...data }))
}

export class SupabaseError extends Error {
  constructor(
    public status: number,
    public pgCode: string | null,
    message: string,
    public traceId: string,
  ) {
    super(message)
    this.name = "SupabaseError"
  }
}

// Database exception text -> safe, stable API codes. Raw database text is never returned to the browser.
const ERROR_MAP: Array<{ test: RegExp; code: string; message: string }> = [
  { test: /INSUFFICIENT_FUNDS/, code: "INSUFFICIENT_FUNDS", message: "Your wallet balance is too low." },
  { test: /INSUFFICIENT_COINS/, code: "INSUFFICIENT_COINS", message: "You don't have enough NEXA Coins for this." },
  { test: /COIN_PURCHASE_LIMIT_REACHED/, code: "COIN_PURCHASE_LIMIT_REACHED", message: "You've reached this month's limit of 2 NEXA Coin purchases." },
  { test: /CUSTOMER_NOT_ACTIVE|WALLET_NOT_ACTIVE/, code: "ACCOUNT_RESTRICTED", message: "Your account cannot perform this action right now." },
  { test: /no active cart|cart is empty/i, code: "EMPTY_CART", message: "Your cart is empty." },
  { test: /insufficient stock/i, code: "OUT_OF_STOCK", message: "Not enough stock for an item in your cart." },
  { test: /no longer available/i, code: "PRODUCT_UNAVAILABLE", message: "An item in your cart is no longer available." },
  { test: /IDEMPOTENCY_KEY_REUSED/, code: "DUPLICATE_REQUEST", message: "This request was already used with different details." },
  { test: /PERMISSION_DENIED/, code: "FORBIDDEN", message: "You do not have permission to do this." },
  { test: /INVALID_/, code: "INVALID_REQUEST", message: "The request was not valid." },
]

function redact(text: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clean = key ? text.split(key).join("[redacted]") : text
  return clean.slice(0, 300)
}

export function toApiError(error: unknown, traceId: string, op: string): ApiError {
  if (error instanceof SupabaseError) {
    const hit = ERROR_MAP.find((entry) => entry.test.test(error.message))
    if (hit) {
      logEvent(traceId, op, { outcome: "rejected", code: hit.code })
      return { ok: false, code: hit.code, message: hit.message, traceId }
    }
    logEvent(traceId, op, { outcome: "error", http: error.status, pg: error.pgCode })
  } else {
    // Includes missing-configuration errors. The message is logged server-side only.
    logEvent(traceId, op, { outcome: "error", detail: error instanceof Error ? redact(error.message) : "unknown" })
  }
  return { ok: false, code: "INTERNAL", message: `Something went wrong. Reference: ${traceId}`, traceId }
}

async function sbFetch(path: string, init: { method: string; body?: string }, traceId: string): Promise<unknown> {
  const base = requiredEnv("SUPABASE_URL").replace(/\/$/, "")
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method,
      body: init.body,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller?.signal,
    })
    const text = await res.text()
    let body: any = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    if (!res.ok) {
      throw new SupabaseError(res.status, body?.code ?? null, String(body?.message ?? text).slice(0, 500), traceId)
    }
    return body
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>, traceId: string): Promise<T> {
  return (await sbFetch(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }, traceId)) as T
}

/** Read rows with PostgREST filters. Build filters ONLY from server-resolved values (see `eq`). */
export async function selectRows<T = Record<string, unknown>>(
  table: string,
  query: Record<string, string>,
  traceId: string,
): Promise<T[]> {
  const qs = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
    .join("&")
  return (await sbFetch(`/rest/v1/${table}?${qs}`, { method: "GET" }, traceId)) as T[]
}

export function eq(value: string): string {
  return `eq.${encodeURIComponent(value)}`
}

type CustomerRow = { id: string; status: string; referral_code: string; username: string | null }

async function findCustomer(ext: string, traceId: string): Promise<CustomerRow | null> {
  const rows = await selectRows<CustomerRow>(
    "evara_customers",
    { external_auth_id: eq(ext), select: "id,status,referral_code,username", limit: "1" },
    traceId,
  )
  return rows[0] ?? null
}

/**
 * Grants the one-time welcome bonus and assigns a default @handle. Both are
 * best-effort: a failure here is logged, never thrown, and never blocks
 * account creation. The default handle uses
 * evara_customer_generate_default_handle (collision-checked at generation
 * time) + evara_customer_set_username, whose very first call for a customer
 * is free of the 14-day change cooldown — so this doesn't burn the
 * customer's own first free change.
 */
async function grantWelcomeBonusAndHandle(customerId: string, traceId: string): Promise<void> {
  try {
    await rpc(
      "evara_coins_earn",
      {
        p_key: `welcome:${customerId}`,
        p_customer: customerId,
        p_kind: "earn",
        p_amount: WELCOME_BONUS_COINS,
        p_reference: customerId,
        p_reason: "welcome_bonus",
        p_metadata: {},
      },
      traceId,
    )
  } catch (e) {
    logEvent(traceId, "welcome_bonus.failed", { detail: e instanceof Error ? redact(e.message) : "unknown" })
  }
  try {
    const handle = await rpc<string>("evara_customer_generate_default_handle", {}, traceId)
    await rpc("evara_customer_set_username", { p_customer: customerId, p_username: handle }, traceId)
  } catch (e) {
    logEvent(traceId, "default_handle.failed", { detail: e instanceof Error ? redact(e.message) : "unknown" })
  }
}

/**
 * Resolves the authenticated Convex user to their Supabase customer, creating it on first use.
 * Returns an ApiError (never throws for auth problems) when there is no valid session.
 */
export async function resolveCustomer(ctx: ActionCtx, traceId: string): Promise<{ ok: true; customer: CustomerContext } | ApiError> {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required.", traceId }
  }
  const ext = externalIdFor(userId)
  let row = await findCustomer(ext, traceId)

  if (!row) {
    const email = await ctx.runQuery(internal.customer.getUserEmail, { userId })
    const register = (p_email: string | null) =>
      rpc("evara_customer_register", {
        p_ext: ext, p_username: null, p_email, p_phone: null,
        p_ip: null, p_device_model: null, p_device_id: null, p_user_agent: null,
      }, traceId)
    try {
      await register(email)
    } catch (e) {
      if (e instanceof SupabaseError && e.pgCode === "23514") {
        await register(null) // email failed the format check; register without it
      } else if (!(e instanceof SupabaseError && e.pgCode === "23505")) {
        throw e // 23505 = a concurrent first request won the race; fall through and re-read
      }
    }
    row = await findCustomer(ext, traceId)
    if (!row) {
      // Most likely the email already belongs to another customer. Never auto-link accounts.
      logEvent(traceId, "identity.resolve", { outcome: "conflict" })
      return { ok: false, code: "IDENTITY_CONFLICT", message: "We could not set up your account. Please contact support.", traceId }
    }
    logEvent(traceId, "identity.resolve", { outcome: "created_or_linked" })
    await grantWelcomeBonusAndHandle(row.id, traceId)
    row = await findCustomer(ext, traceId) // re-read to pick up the just-assigned username
  }

  if (!row) {
    return { ok: false, code: "IDENTITY_CONFLICT", message: "We could not set up your account. Please contact support.", traceId }
  }
  return { ok: true, customer: { customerId: row.id, status: row.status, referralCode: row.referral_code, username: row.username } }
}

/**
 * Standard wrapper for every customer-facing action: verify session -> resolve customer -> run handler.
 * The handler receives the SERVER-resolved customerId; there is no way to pass one in from the browser.
 */
export async function withCustomer<T extends object>(
  ctx: ActionCtx,
  op: string,
  handler: (customer: CustomerContext, traceId: string) => Promise<T>,
): Promise<({ ok: true } & T) | ApiError> {
  const traceId = newTraceId()
  try {
    const resolved = await resolveCustomer(ctx, traceId)
    if (!resolved.ok) return resolved
    const result = await handler(resolved.customer, traceId)
    return { ok: true as const, ...result }
  } catch (e) {
    return toApiError(e, traceId, op)
  }
}
