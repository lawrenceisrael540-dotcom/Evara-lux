import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { internalMutation, mutation, query } from "./_generated/server"
import { DEFAULT_MEMBERSHIP_TIER, getMembershipRow, hasMembershipTier, membershipTierRank } from "./membershipLib"

const invited = new Set(["apex_imperial","sovereign_aethel"])
function hasTier(tier: string | undefined, minimum: any) { return hasMembershipTier(tier, minimum) }
async function getMembership(ctx: any, userId: any) { return await getMembershipRow(ctx, userId) }
async function audit(ctx: any, userId: any, tier: string, action: string, feature: string, metadata?: any) { await ctx.db.insert("sovereignPrivilegeAudit", { userId, tier, action, feature, metadata, createdAt: Date.now() }) }

function defaultTier() { return DEFAULT_MEMBERSHIP_TIER }

export const getMyMembership = query({
  args: {}, returns: v.any(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const row = await ctx.db.query("membershipProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    return row ?? { userId, tier: defaultTier(), points: 0, updatedAt: Date.now() }
  },
})

export const setMyTier = mutation({
  args: { tier: v.union(v.literal("obsidian"), v.literal("sovereign"), v.literal("sovereign_gilded"), v.literal("apex_imperial"), v.literal("sovereign_aethel")) },
  returns: v.boolean(),
  handler: async (ctx, { tier }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    // Invitation-only tiers cannot be self-selected.
    if (invited.has(tier)) {
      const invite = await ctx.db.query("membershipInvitations").withIndex("by_user", q => q.eq("userId", userId)).filter(q => q.eq(q.field("tier"), tier)).filter(q => q.eq(q.field("status"), "accepted")).first()
      if (!invite) return false
    }
    const existing = await ctx.db.query("membershipProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    if (existing) { const previousTier = existing.tier; await ctx.db.patch(existing._id, { tier, updatedAt: Date.now() }); if (previousTier !== tier) await audit(ctx, userId, tier, "tier_changed", "membership", { from: previousTier, to: tier }) }
    else { await ctx.db.insert("membershipProfiles", { userId, tier, points: 0, updatedAt: Date.now() }); await audit(ctx, userId, tier, "tier_created", "membership") }
    return true
  },
})

export const listLiveChallenges = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const now = Date.now()
    const rows = await ctx.db.query("engagementChallenges").withIndex("by_status_end", q => q.eq("status", "live")).take(50)
    const userId = await getAuthUserId(ctx)
    if (!userId) return rows.map(x => ({...x, progress: 0}))
    const progress = await ctx.db.query("challengeProgress").withIndex("by_user", q => q.eq("userId", userId)).take(100)
    return rows.filter(x => x.startsAt <= now && x.endsAt > now).map(x => ({...x, progress: progress.find(p => p.challengeId === x._id)?.progress ?? 0}))
  },
})

export const recordChallengeProgress = mutation({
  args: { challengeId: v.id("engagementChallenges"), amount: v.number(), placement: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { challengeId, amount } = args
    const userId = await getAuthUserId(ctx)
    if (!userId || amount <= 0) return false
    const challenge = await ctx.db.get(challengeId)
    if (!challenge || challenge.status !== "live" || challenge.endsAt <= Date.now()) return false
    const existing = await ctx.db.query("challengeProgress").withIndex("by_challenge_user", q => q.eq("challengeId", challengeId).eq("userId", userId)).unique()
    const next = Math.min(100, (existing?.progress ?? 0) + amount)
    const membership = await getMembership(ctx, userId)
    const placement = Math.trunc(args.placement ?? 0)
    if (placement !== 0 && (placement < 1 || placement > 3)) return false
    if (existing) await ctx.db.patch(existing._id, { progress: next, placement: placement || existing.placement, completedAt: next >= 100 ? Date.now() : undefined })
    else await ctx.db.insert("challengeProgress", { challengeId, userId, progress: next, placement: placement || undefined, completedAt: next >= 100 ? Date.now() : undefined })
    if (next >= 100) {
      const multiplier = membership && placement >= 1 && placement <= 3 ? (membership.tier === "sovereign_gilded" || membership.tier === "apex_imperial" || membership.tier === "sovereign_aethel" ? 1.25 : hasTier(membership.tier, "sovereign") ? 1.1 : 1) : 1
      const awarded = Math.round(challenge.pointsReward * multiplier)
      if (membership) await ctx.db.patch(membership._id, { points: membership.points + awarded, updatedAt: Date.now() })
      else await ctx.db.insert("membershipProfiles", { userId, tier: defaultTier(), points: awarded, updatedAt: Date.now() })
      if (membership && multiplier !== 1) await audit(ctx, userId, membership.tier, "rewarded", "challenge_podium", { challengeId: String(challengeId), placement, multiplier, basePoints: challenge.pointsReward, awarded })
      else await ctx.db.insert("membershipProfiles", { userId, tier: defaultTier(), points: challenge.pointsReward, updatedAt: Date.now() })
      const key = "challenge:"+String(challengeId)
      const badge = await ctx.db.query("engagementBadges").withIndex("by_user_key", q => q.eq("userId", userId).eq("key", key)).unique()
      if (!badge) await ctx.db.insert("engagementBadges", { userId, key, label: challenge.cosmeticReward ?? "Challenge Complete", awardedAt: Date.now() })
    }
    return true
  },
})

export const listMyBadges = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return ctx.db.query("engagementBadges").withIndex("by_user", q => q.eq("userId", userId)).order("desc").take(50)
  },
})

export const createPlayRoom = mutation({
  args: { name: v.string(), game: v.union(v.literal("trivia"), v.literal("puzzle"), v.literal("creative")), access: v.union(v.literal("invite_only"), v.literal("circle")) },
  returns: v.union(v.id("familyPlayRooms"), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId || !args.name.trim()) return null
    return ctx.db.insert("familyPlayRooms", { ownerId: userId, name: args.name.trim().slice(0, 80), game: args.game, access: args.access, status: "open", createdAt: Date.now() })
  },
})

export const listMyPlayRooms = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return ctx.db.query("familyPlayRooms").withIndex("by_owner", q => q.eq("ownerId", userId)).order("desc").take(20)
  },
})

export const getNexaLedger = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId=await getAuthUserId(ctx); if(!userId)return []
    return ctx.db.query("nexaPointTransactions").withIndex("by_user_created",q=>q.eq("userId",userId)).order("desc").take(50)
  },
})

export const awardNexaPoints = internalMutation({
  args:{amount:v.number(),reason:v.string(),source:v.union(v.literal("challenge"),v.literal("social"),v.literal("purchase"),v.literal("badge"),v.literal("admin"),v.literal("adjustment")),referenceId:v.optional(v.string())},
  returns:v.union(v.object({ok:v.literal(true),balance:v.number()}),v.object({ok:v.literal(false),message:v.string()})),
  handler:async(ctx,args)=>{
    const userId=await getAuthUserId(ctx); if(!userId)return {ok:false as const,message:"Sign in required."}
    const amount=Math.trunc(args.amount); if(!Number.isFinite(amount)||amount===0||Math.abs(amount)>10000||!args.reason.trim())return {ok:false as const,message:"Invalid points adjustment."}
    const existing=await ctx.db.query("membershipProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique()
    const current=existing?.points??0; const balance=Math.max(0,current+amount)
    if(existing)await ctx.db.patch(existing._id,{points:balance,updatedAt:Date.now()})
    else await ctx.db.insert("membershipProfiles",{userId,tier:"obsidian",points:balance,updatedAt:Date.now()})
    await ctx.db.insert("nexaPointTransactions",{userId,amount,reason:args.reason.trim().slice(0,240),source:args.source,referenceId:args.referenceId,createdAt:Date.now()})
    return {ok:true as const,balance}
  },
})

export const getNexaLeaderboard = query({
  args:{}, returns:v.array(v.any()),
  handler:async(ctx)=>{
    const rows=await ctx.db.query("membershipProfiles").withIndex("by_tier").take(200)
    const ranked=[...rows].sort((a,b)=>b.points-a.points).slice(0,25); const out:any[]=[]
    for(const row of ranked){const profile=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",row.userId)).unique();if(profile)out.push({userId:row.userId,username:profile.username??"member",displayName:profile.displayName??profile.username??"Evara Member",tier:row.tier,points:row.points})}
    return out
  },
})

export const getSovereignFeatures = query({
  args: {}, returns: v.any(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx); if (!userId) return { tier: "obsidian", isSovereign: false, rank: 1, hideFromLimit: 10, pointsPlacementMultiplier: 1, maxPinnedMedia: 0, profileCustomization: false, discoveryBoost: false, privatePlayRooms: false }
    const membership = await getMembership(ctx, userId); const tier = membership?.tier ?? "obsidian"; const sovereign = hasTier(tier, "sovereign")
    return { tier, isSovereign: sovereign, rank: membershipTierRank(tier), hideFromLimit: sovereign ? 50 : 10, pointsPlacementMultiplier: sovereign ? 1.1 : 1, maxPinnedMedia: sovereign ? 6 : 0, profileCustomization: sovereign, discoveryBoost: sovereign, privatePlayRooms: sovereign, media: sovereign ? { videoMaxBytes: 250 * 1024 * 1024, storyMaxBytes: 150 * 1024 * 1024, highResolution: true } : { videoMaxBytes: 50 * 1024 * 1024, storyMaxBytes: 25 * 1024 * 1024, highResolution: false } }
  },
})

export const upsertSovereignProfile = mutation({
  args: {
    customBioStyle: v.union(v.literal("classic"), v.literal("editorial"), v.literal("steel"), v.literal("minimal")),
    pinnedMediaUrls: v.array(v.string()), linkInBioLabel: v.optional(v.string()), linkInBioUrl: v.optional(v.string()), statusTag: v.optional(v.string()), discoveryBoostEnabled: v.boolean(),
  }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx); if (!userId) return false
    const membership = await getMembership(ctx, userId); const tier = membership?.tier ?? "obsidian"; if (!hasTier(tier, "sovereign")) return false
    if (args.pinnedMediaUrls.length > 6 || (args.linkInBioUrl && !/^https?:\/\//i.test(args.linkInBioUrl))) return false
    const existing = await ctx.db.query("sovereignProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    const payload = { ...args, pinnedMediaUrls: args.pinnedMediaUrls.slice(0, 6), updatedAt: Date.now() }
    if (existing) await ctx.db.patch(existing._id, payload); else await ctx.db.insert("sovereignProfiles", { userId, ...payload })
    await audit(ctx, userId, tier, "updated", "profile_customization", { pinnedMediaCount: payload.pinnedMediaUrls.length }); return true
  },
})

export const getMySovereignProfile = query({
  args: {}, returns: v.union(v.any(), v.null()),
  handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return null; const membership = await getMembership(ctx, userId); if (!hasTier(membership?.tier, "sovereign")) return null; return await ctx.db.query("sovereignProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique() },
})

export const getSovereignAudit = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return []; const membership = await getMembership(ctx, userId); if (!hasTier(membership?.tier, "sovereign")) return []; return await ctx.db.query("sovereignPrivilegeAudit").withIndex("by_user_created", q => q.eq("userId", userId)).order("desc").take(50) },
})
