import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { mutation, query, type MutationCtx } from "./_generated/server"
import { newTraceId } from "./trace"
import { getMembershipTier, membershipTierLabel } from "./membershipLib"

// This is a *loyalty rewards ladder* — driven by lifetime spend, stored on loyaltyAccounts.tier —
// and is a separate concept from membership tier (obsidian/sovereign/sovereign_gilded/
// apex_imperial/sovereign_aethel, stored on membershipProfiles.tier and gated by invitation or
// points there). Keeping it distinct on purpose: this ladder is not what "tier" means for
// display or feature-gating elsewhere in the app — see membershipLib.ts.
const TIERS = [
  { name: "Passage", threshold: 0 },
  { name: "Signature", threshold: 2000 },
  { name: "Sovereign", threshold: 10000 },
  { name: "Imperial", threshold: 30000 },
  { name: "Evara", threshold: 75000 },
] as const

function tierFor(points: number): string {
  let tier: string = TIERS[0].name
  for (const item of TIERS) if (points >= item.threshold) tier = item.name
  return tier
}

async function makePublicId(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const raw = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()
    const candidate = `EVL-${raw}`
    const exists = await ctx.db
      .query("userProfiles")
      .withIndex("by_public_id", (q) => q.eq("publicId", candidate))
      .unique()
    if (!exists) return candidate
  }
  throw new Error("PUBLIC_ID_GENERATION_FAILED")
}

export const ensureMyAccount = mutation({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      publicId: v.string(),
      level: v.number(),
      tier: v.string(),
      verificationStatus: v.string(),
      twoFactorEnabled: v.boolean(),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }

    const user = await ctx.db.get(userId)
    if (!user) return { ok: false as const, code: "USER_NOT_FOUND", message: "Account not found." }

    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()

    const publicId = profile?.publicId ?? await makePublicId(ctx)
    const existingSecurity = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()

    if (!profile) {
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        role: "customer",
        publicId,
        level: 1,
        // "Passage" here is bookkeeping for makePublicId's uniqueness scan and any legacy
        // reader of userProfiles.tier — it is never returned as the member's tier below.
        tier: "Passage",
        verificationStatus: "verified",
        emailVerified: true,
        twoFactorEnabled: existingSecurity?.twoFactorEnabled ?? false,
      })
      profile = await ctx.db.get(profileId)
    } else {
      const patch: Record<string, unknown> = {}
      if (!profile.publicId) patch.publicId = publicId
      if (profile.level === undefined) patch.level = 1
      if (!profile.tier) patch.tier = "Passage"
      if (!profile.verificationStatus) patch.verificationStatus = "verified"
      if (profile.emailVerified === undefined) patch.emailVerified = true
      if (profile.twoFactorEnabled === undefined) patch.twoFactorEnabled = existingSecurity?.twoFactorEnabled ?? false
      if (Object.keys(patch).length) await ctx.db.patch(profile._id, patch)
      profile = await ctx.db.get(profile._id)
    }

    const wallet = await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (!wallet) {
      await ctx.db.insert("wallets", { userId, balanceMinor: 0n, currency: "NGN", status: "active" })
    }

    const loyalty = await ctx.db.query("loyaltyAccounts").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (!loyalty) {
      await ctx.db.insert("loyaltyAccounts", { userId, pointsBalance: 0, lifetimePoints: 0, tier: "Passage" })
    } else {
      const nextTier = tierFor(loyalty.lifetimePoints)
      if (loyalty.tier !== nextTier) await ctx.db.patch(loyalty._id, { tier: nextTier })
    }

    const coins = await ctx.db.query("coinAccounts").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (!coins) {
      await ctx.db.insert("coinAccounts", { userId, balance: 0, lifetimeCoins: 0 })
    }

    if (!existingSecurity) {
      await ctx.db.insert("userSecurity", { userId, twoFactorEnabled: false })
    }

    await ctx.db.insert("traceEvents", {
      traceId: newTraceId(),
      userId,
      kind: "account.ensure",
      status: "completed",
      metadata: { level: 1 },
    })

    const latest = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()

    // The member's real tier is membershipProfiles.tier, not userProfiles.tier — see
    // membershipLib.ts. ensureMyAccount never creates/changes a membershipProfiles row (that's
    // membership.setMyTier's job); it only reads whatever is already there, defaulting to obsidian.
    const membership = await getMembershipTier(ctx, userId)

    return {
      ok: true as const,
      publicId: latest?.publicId ?? publicId,
      level: latest?.level ?? 1,
      tier: membership.tier,
      verificationStatus: latest?.verificationStatus ?? "verified",
      twoFactorEnabled: latest?.twoFactorEnabled ?? false,
    }
  },
})

export const getMySnapshot = query({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      publicId: v.string(),
      displayName: v.union(v.string(), v.null()),
      username: v.union(v.string(), v.null()),
      level: v.number(),
      tier: v.string(),
      verificationStatus: v.string(),
      emailVerified: v.boolean(),
      twoFactorEnabled: v.boolean(),
      balanceMinor: v.int64(),
      currency: v.string(),
      pointsBalance: v.number(),
      lifetimePoints: v.number(),
      coinsBalance: v.number(),
      lifetimeCoins: v.number(),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }

    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (!profile) return { ok: false as const, code: "ACCOUNT_NOT_READY", message: "Account is still being prepared." }

    const wallet = await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    const loyalty = await ctx.db.query("loyaltyAccounts").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    const coins = await ctx.db.query("coinAccounts").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    const security = await ctx.db.query("userSecurity").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    // Membership tier — the real one, not userProfiles.tier or loyaltyAccounts.tier (that's a
    // separate spend-ladder concept). See membershipLib.ts for why this was wrong before.
    const membership = await getMembershipTier(ctx, userId)

    return {
      ok: true as const,
      publicId: profile.publicId ?? "EVL-PENDING",
      displayName: profile.displayName ?? null,
      username: profile.username ?? null,
      level: profile.level ?? 1,
      tier: membershipTierLabel(membership.tier),
      verificationStatus: profile.verificationStatus ?? "verified",
      emailVerified: profile.emailVerified ?? true,
      twoFactorEnabled: security?.twoFactorEnabled ?? profile.twoFactorEnabled ?? false,
      balanceMinor: wallet?.balanceMinor ?? 0n,
      currency: wallet?.currency ?? "NGN",
      pointsBalance: loyalty?.pointsBalance ?? 0,
      lifetimePoints: loyalty?.lifetimePoints ?? 0,
      coinsBalance: coins?.balance ?? 0,
      lifetimeCoins: coins?.lifetimeCoins ?? 0,
    }
  },
})


export const completeProfile = mutation({
  args: {
    displayName: v.string(),
    username: v.string(),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    ageRange: v.optional(v.union(v.literal("13-17"), v.literal("18-24"), v.literal("25-34"), v.literal("35-44"), v.literal("45-54"), v.literal("55-64"), v.literal("65+"))),
    gender: v.optional(v.union(v.literal("woman"), v.literal("man"), v.literal("nonbinary"), v.literal("prefer_not_to_say"))),
  },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    if (!profile) return { ok: false, message: "Create the account foundation first." }
    const username = args.username.trim().replace(/^@/, "").toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(username)) return { ok: false, message: "Username must be 3–30 characters using letters, numbers or underscores." }
    const existing = await ctx.db.query("userProfiles").withIndex("by_username_lower", q => q.eq("usernameLower", username)).unique()
    if (existing && existing.userId !== userId) return { ok: false, message: "That username is already taken." }
    if (args.displayName.trim().length < 2) return { ok: false, message: "Enter your name." }
    await ctx.db.patch(profile._id, {
      displayName: args.displayName.trim().slice(0, 100),
      username: username.slice(0, 30),
      usernameLower: username.slice(0, 30),
      phone: args.phone?.trim() || profile.phone,
      country: args.country?.trim().slice(0, 80),
      ageRange: args.ageRange,
      gender: args.gender,
    })
    return { ok: true, message: "Profile saved." }
  },
})


export const resolveLoginIdentifier = query({
  args: { identifier: v.string() },
  returns: v.object({ ok:v.boolean(), email:v.optional(v.string()), message:v.string() }),
  handler: async (ctx, { identifier }) => {
    const raw = identifier.trim().replace(/^@/, "").toLowerCase()
    const profile = await ctx.db.query("userProfiles").withIndex("by_username_lower", q => q.eq("usernameLower", raw)).unique()
    if (profile) {
      const user = await ctx.db.get(profile.userId)
      if (user?.email) return { ok:true, email:user.email, message:"Username resolved." }
    }
    const user = await ctx.db.query("users").withIndex("email", q => q.eq("email", raw)).unique()
    if (user?.email) return { ok:true, email:user.email, message:"Email resolved." }
    return { ok:false, message:"We couldn't find that account." }
  },
})
