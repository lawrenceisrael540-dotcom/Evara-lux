import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"

const defaults = {
  profileMode: "public" as const,
  showFollowers: true,
  showFollowing: true,
  showLikes: true,
  showComments: true,
  showReshares: true,
  showViews: true,
  privateMetrics: false,
  hideNegativeComments: true,
  ghostShieldMode: "standard" as const,
  ghostShieldRules: {},
}

export const getMyPrivacy = query({
  args: {},
  returns: v.object({
    profileMode: v.union(v.literal("public"), v.literal("contact_only"), v.literal("private")),
    showFollowers: v.boolean(), showFollowing: v.boolean(), showLikes: v.boolean(),
    showComments: v.boolean(), showReshares: v.boolean(), showViews: v.boolean(),
    privateMetrics: v.boolean(), hideNegativeComments: v.boolean(),
    ghostShieldMode: v.union(v.literal("standard"), v.literal("strict"), v.literal("custom")),
    ghostShieldRules: v.optional(v.any()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return defaults
    const row = await ctx.db.query("privacySettings").withIndex("by_user", q => q.eq("userId", userId)).unique()
    return row ? {
      profileMode: row.profileMode, showFollowers: row.showFollowers, showFollowing: row.showFollowing,
      showLikes: row.showLikes, showComments: row.showComments, showReshares: row.showReshares,
      showViews: row.showViews, privateMetrics: row.privateMetrics, hideNegativeComments: row.hideNegativeComments,
      ghostShieldMode: row.ghostShieldMode ?? "standard", ghostShieldRules: row.ghostShieldRules ?? {},
    } : defaults
  },
})

export const updateMyPrivacy = mutation({
  args: {
    profileMode: v.union(v.literal("public"), v.literal("contact_only"), v.literal("private")),
    showFollowers: v.boolean(), showFollowing: v.boolean(), showLikes: v.boolean(),
    showComments: v.boolean(), showReshares: v.boolean(), showViews: v.boolean(),
    privateMetrics: v.boolean(), hideNegativeComments: v.boolean(),
    ghostShieldMode: v.union(v.literal("standard"), v.literal("strict"), v.literal("custom")),
    ghostShieldRules: v.optional(v.any()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    const existing = await ctx.db.query("privacySettings").withIndex("by_user", q => q.eq("userId", userId)).unique()
    const membership = await ctx.db.query("membershipProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    const elevated = ["sovereign","sovereign_gilded","apex_imperial","sovereign_aethel"].includes(membership?.tier ?? "obsidian")
    if (args.ghostShieldMode !== "standard" && !elevated) return false
    if (existing) await ctx.db.patch(existing._id, args)
    else await ctx.db.insert("privacySettings", { userId, ...args })
    if (args.ghostShieldMode !== "standard") await ctx.db.insert("sovereignPrivilegeAudit", { userId, tier: membership?.tier ?? "obsidian", action: "updated", feature: "ghost_shield", metadata: { mode: args.ghostShieldMode }, createdAt: Date.now() })
    return true
  },
})

export const addTrustedAccount = mutation({
  args: { trustedUserId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { trustedUserId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId || userId === trustedUserId) return false
    const existing = await ctx.db.query("privacyTrustedAccounts").withIndex("by_user_trusted", q => q.eq("userId", userId).eq("trustedUserId", trustedUserId)).unique()
    if (!existing) await ctx.db.insert("privacyTrustedAccounts", { userId, trustedUserId, createdAt: Date.now() })
    return true
  },
})

export const removeTrustedAccount = mutation({
  args: { trustedUserId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { trustedUserId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    const existing = await ctx.db.query("privacyTrustedAccounts").withIndex("by_user_trusted", q => q.eq("userId", userId).eq("trustedUserId", trustedUserId)).unique()
    if (existing) await ctx.db.delete(existing._id)
    return true
  },
})

export const getMyMetrics = query({
  args: {},
  returns: v.object({
    followers: v.number(), following: v.number(), likes: v.number(), comments: v.number(), reshares: v.number(), views: v.number()
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { followers: 0, following: 0, likes: 0, comments: 0, reshares: 0, views: 0 }
    const [followers, following, posts, comments] = await Promise.all([
      ctx.db.query("socialConnections").withIndex("by_target_kind", q => q.eq("targetUserId", userId).eq("kind", "follow")).take(10000),
      ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", userId)).take(10000),
      ctx.db.query("feedItems").withIndex("by_author", q => q.eq("authorId", userId)).take(10000),
      ctx.db.query("comments").withIndex("by_user", q => q.eq("userId", userId)).take(10000),
    ])
    return {
      followers: followers.filter(x => x.status === "active" || x.status === "accepted").length,
      following: following.filter(x => x.kind === "follow" || x.kind === "friend").length,
      likes: posts.reduce((n, p) => n + p.likeCount, 0),
      comments: comments.length,
      reshares: posts.reduce((n, p) => n + p.shareCount, 0),
      views: posts.reduce((n, p) => n + p.viewCount, 0),
    }
  },
})

export const getPublicProfile = query({
  args: { username: v.string() },
  returns: v.any(),
  handler: async (ctx, { username }) => {
    const viewerId = await getAuthUserId(ctx)
    const profile = await ctx.db.query("userProfiles").withIndex("by_username_lower", q => q.eq("usernameLower", username.replace(/^@/, "").toLowerCase())).unique()
    if (!profile) return null
    const settings = await ctx.db.query("privacySettings").withIndex("by_user", q => q.eq("userId", profile.userId)).unique()
    const mode = settings?.profileMode ?? "public"
    const isOwner = viewerId === profile.userId
    const relation = viewerId ? await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", viewerId).eq("targetUserId", profile.userId)).unique() : null
    const approved = isOwner || relation?.kind === "friend" || relation?.status === "accepted" || relation?.status === "active"
    const fullAccess = mode === "public" || approved
    if (!fullAccess) {
      return {
        access: "contact_only",
        username: profile.username ?? null,
        displayName: profile.displayName ?? null,
        verificationStatus: profile.verificationStatus ?? "pending",
        message: "This profile is protected. Posts, media and private metrics are hidden.",
      }
    }
    const posts = await ctx.db.query("feedItems").withIndex("by_author", q => q.eq("authorId", profile.userId)).take(100)
    const metrics = {
      followers: settings?.showFollowers !== false,
      following: settings?.showFollowing !== false,
      likes: settings?.showLikes !== false,
      comments: settings?.showComments !== false,
      reshares: settings?.showReshares !== false,
      views: settings?.showViews !== false,
    }
    return {
      access: "full", username: profile.username ?? null, displayName: profile.displayName ?? null,
      verificationStatus: profile.verificationStatus ?? "pending",
      metrics, privateMetrics: settings?.privateMetrics ?? false, posts: posts.filter(p => p.status === "published"),
    }
  },
})
