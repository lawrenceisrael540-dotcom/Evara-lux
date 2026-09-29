import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { generateSecret, otpUri, verifyTotp } from "./totp"

export const getMySecurity = query({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      twoFactorEnabled: v.boolean(),
      emailVerified: v.boolean(),
      verificationStatus: v.string(),
      lastTwoFactorAt: v.union(v.number(), v.null()),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    return {
      ok: true as const,
      twoFactorEnabled: security?.twoFactorEnabled ?? false,
      emailVerified: profile?.emailVerified ?? false,
      verificationStatus: profile?.verificationStatus ?? "pending",
      lastTwoFactorAt: security?.lastTwoFactorAt ?? null,
    }
  },
})

export const beginTwoFactorSetup = action({
  args: {},
  returns: v.union(
    v.object({ ok: v.literal(true), secret: v.string(), otpauthUri: v.string() }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const userId = await ctx.runQuery(internal.security.getUserEmailForSetup, {})
    if (!userId) return { ok: false as const, code: "ACCOUNT_NOT_READY", message: "Account is still being prepared." }
    const secret = await generateSecret()
    await ctx.runMutation(internal.security.savePendingSecret, { secret })
    return { ok: true as const, secret, otpauthUri: otpUri(secret, userId) }
  },
})

export const getUserEmailForSetup = internalQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    return user?.email ?? null
  },
})

export const savePendingSecret = internalMutation({
  args: { secret: v.string() },
  returns: v.null(),
  handler: async (ctx, { secret }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const existing = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (existing) await ctx.db.patch(existing._id, { twoFactorPending: secret })
    else await ctx.db.insert("userSecurity", { userId, twoFactorEnabled: false, twoFactorPending: secret })
    return null
  },
})

export const verifyTwoFactorSetup = action({
  args: { code: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { code }) => {
    const security = await ctx.runQuery(internal.security.getSecurityForVerify, {})
    if (!security?.pending) return { ok: false as const, code: "NO_PENDING_SETUP", message: "Start 2FA setup again." }
    if (!(await verifyTotp(security.pending, code))) {
      return { ok: false as const, code: "INVALID_CODE", message: "That authenticator code is invalid or expired." }
    }
    await ctx.runMutation(internal.security.enableTwoFactor, { secret: security.pending })
    return { ok: true as const }
  },
})

export const getSecurityForVerify = internalQuery({
  args: {},
  returns: v.union(v.object({ pending: v.string() }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    return security?.twoFactorPending ? { pending: security.twoFactorPending } : null
  },
})

export const enableTwoFactor = internalMutation({
  args: { secret: v.string() },
  returns: v.null(),
  handler: async (ctx, { secret }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (security) await ctx.db.patch(security._id, { twoFactorEnabled: true, twoFactorSecret: secret, twoFactorPending: undefined, twoFactorVerifiedAt: Date.now() })
    await ctx.db.patch((await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique())!._id, { twoFactorEnabled: true })
    return null
  },
})

export const disableTwoFactor = mutation({
  args: {},
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string(), message: v.string() })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (security) await ctx.db.patch(security._id, { twoFactorEnabled: false, twoFactorSecret: undefined, twoFactorPending: undefined })
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (profile) await ctx.db.patch(profile._id, { twoFactorEnabled: false })
    return { ok: true as const }
  },
})

export const verifyTwoFactorCode = action({
  args: { code: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { code }) => {
    const security = await ctx.runQuery(internal.security.getEnabledSecret, {})
    if (!security?.secret) return { ok: false as const, code: "NOT_ENABLED", message: "Two-factor authentication is not enabled." }
    if (!(await verifyTotp(security.secret, code))) return { ok: false as const, code: "INVALID_CODE", message: "That authenticator code is invalid or expired." }
    await ctx.runMutation(internal.security.recordTwoFactorUse, {})
    return { ok: true as const }
  },
})

export const getEnabledSecret = internalQuery({
  args: {},
  returns: v.union(v.object({ secret: v.string() }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    return security?.twoFactorEnabled && security.twoFactorSecret ? { secret: security.twoFactorSecret } : null
  },
})

export const recordTwoFactorUse = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (security) await ctx.db.patch(security._id, { lastTwoFactorAt: Date.now() })
    return null
  },
})
