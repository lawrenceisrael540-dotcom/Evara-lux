import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"

// Bump this when the policy text actually changes — every acceptance row
// records the version shown at accept time, so a future policy change can
// tell who accepted the old text vs the new one.
export const CURRENT_POLICY_VERSION = "2026-09-25"

const consentKind = v.union(
  v.literal("age_confirmation"),
  v.literal("terms_of_service"),
  v.literal("privacy_policy"),
  v.literal("cookie_consent"),
)

// Records one consent event. Called from signup (age + ToS + Privacy) and
// from the cookie banner (cookie_consent). Never overwrites a prior row —
// each acceptance is its own auditable entry.
export const recordConsent = mutation({
  args: { kind: consentKind, version: v.optional(v.string()) },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, { kind, version }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, message: "Sign in required." }
    await ctx.db.insert("legalConsents", {
      userId,
      kind,
      version: version ?? CURRENT_POLICY_VERSION,
      acceptedAt: Date.now(),
    })
    return { ok: true as const }
  },
})

export const getMyConsents = query({
  args: {},
  returns: v.array(v.object({ kind: consentKind, version: v.string(), acceptedAt: v.number() })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const rows = await ctx.db
      .query("legalConsents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    return rows.map((r) => ({ kind: r.kind, version: r.version, acceptedAt: r.acceptedAt }))
  },
})

// Right-to-erasure / right-to-delete request. Recorded, not auto-executed —
// see the schema comment on dataDeletionRequests for why. One open request
// per account at a time.
export const requestDataDeletion = mutation({
  args: { reason: v.optional(v.string()) },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { reason }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const user = await ctx.db.get(userId)
    if (!user?.email) return { ok: false as const, code: "NO_EMAIL", message: "Account has no email on file." }

    const existing = await ctx.db
      .query("dataDeletionRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    const open = existing.find((r) => r.status === "pending" || r.status === "in_review")
    if (open) return { ok: false as const, code: "ALREADY_PENDING", message: "A deletion request is already pending for this account." }

    await ctx.db.insert("dataDeletionRequests", {
      userId,
      email: user.email,
      reason: reason?.trim().slice(0, 500),
      status: "pending",
      requestedAt: Date.now(),
    })
    return { ok: true as const }
  },
})

export const getMyDeletionRequest = query({
  args: {},
  returns: v.union(
    v.object({
      status: v.union(v.literal("pending"), v.literal("in_review"), v.literal("completed"), v.literal("rejected")),
      requestedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const rows = await ctx.db
      .query("dataDeletionRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1)
    const latest = rows[0]
    return latest ? { status: latest.status, requestedAt: latest.requestedAt } : null
  },
})
