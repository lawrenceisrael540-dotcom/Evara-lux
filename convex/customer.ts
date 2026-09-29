import { v } from "convex/values"
import { action, internalQuery } from "./_generated/server"
import { withCustomer, rpc } from "./supabase"

// Internal only: used by the identity resolver to read the signed-in user's email.
export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    return user?.email ?? null
  },
})

// Guarantees the signed-in Convex user has exactly one Supabase customer record.
// Returns only what the UI needs; the Supabase customer id is never sent to the browser.
export const ensureMyCustomer = action({
  args: {},
  returns: v.union(
    v.object({ ok: v.literal(true), status: v.string(), referralCode: v.string(), username: v.union(v.string(), v.null()) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string(), traceId: v.string() }),
  ),
  handler: async (ctx) =>
    withCustomer(ctx, "customer.ensure", async (customer) => ({
      status: customer.status,
      referralCode: customer.referralCode,
      username: customer.username,
    })),
})

// Applies a referral code to the signed-in customer, if they don't already
// have one on file. Idempotent (evara_customer_set_referrer only sets
// referred_by while it's still null) — safe to call every time a referral
// link is opened, not just once. Call this once right after signup, with
// whatever code came from the signup page's ?ref= link.
export const applyReferralCode = action({
  args: { referralCode: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), applied: v.boolean(), code: v.optional(v.string()) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string(), traceId: v.string() }),
  ),
  handler: async (ctx, { referralCode }) =>
    withCustomer(ctx, "customer.applyReferralCode", async (customer, traceId) => {
      const trimmed = referralCode.trim()
      if (!trimmed) return { applied: false, code: "EMPTY_CODE" }
      const result = await rpc<{ applied: boolean; code?: string }>(
        "evara_customer_set_referrer",
        { p_customer: customer.customerId, p_referral_code: trimmed },
        traceId,
      )
      return { applied: result.applied, code: result.code }
    }),
})

// Changes the signed-in customer's @handle. The customer's very first-ever
// set is free (handled server-side by grantWelcomeBonusAndHandle at signup);
// any change after that is limited to once every 14 days by
// evara_customer_set_username itself, not just this UI.
export const setUsername = action({
  args: { username: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), changed: v.boolean(), code: v.optional(v.string()), username: v.optional(v.string()), availableAt: v.optional(v.string()) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string(), traceId: v.string() }),
  ),
  handler: async (ctx, { username }) =>
    withCustomer(ctx, "customer.setUsername", async (customer, traceId) => {
      const trimmed = username.trim()
      if (!/^[A-Za-z0-9_.]{3,30}$/.test(trimmed)) {
        throw new Error("INVALID_FORMAT")
      }
      const result = await rpc<{ changed: boolean; code?: string; username?: string; available_at?: string }>(
        "evara_customer_set_username",
        { p_customer: customer.customerId, p_username: trimmed },
        traceId,
      )
      return {
        changed: result.changed,
        code: result.code,
        username: result.username,
        availableAt: result.available_at,
      }
    }),
})
