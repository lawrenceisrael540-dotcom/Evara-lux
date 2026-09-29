import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { internalMutation, mutation, query } from "./_generated/server"

const DEFAULT_WEIGHTS = {
  affinity: 0.28,
  social: 0.16,
  quality: 0.18,
  velocity: 0.14,
  recency: 0.10,
  location: 0.05,
  exploration: 0.09,
}

function hash(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

function recencyScore(createdAt: number) {
  const ageHours = Math.max(0, (Date.now() - createdAt) / 3_600_000)
  return Math.exp(-ageHours / 72)
}

export const setSocialProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    country: v.optional(v.string()),
    locationMode: v.union(v.literal("private"), v.literal("city"), v.literal("region")),
    discoveryEnabled: v.boolean(),
    discoverableTo: v.union(v.literal("friends"), v.literal("everyone"), v.literal("nobody")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    const existing = await ctx.db.query("socialProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    if (existing) await ctx.db.patch(existing._id, args)
    else await ctx.db.insert("socialProfiles", { userId, ...args })
    return true
  },
})

export const createFeedItem = mutation({
  args: {
    body: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
    visibility: v.union(v.literal("public"), v.literal("friends"), v.literal("private")),
    regionBucket: v.optional(v.string()),
    excludedUserIds: v.optional(v.array(v.id("users"))),
    excludedUsernames: v.optional(v.array(v.string())),
    excludedConnectionKinds: v.optional(v.array(v.union(v.literal("follow"), v.literal("friend"), v.literal("blocked")))),
    excludedListName: v.optional(v.string()),
  },
  returns: v.union(v.object({ ok: v.literal(true), id: v.id("feedItems") }), v.object({ ok: v.literal(false), message: v.string() })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, message: "Sign in required." }
    if (!args.body.trim() || args.body.length > 5000) return { ok: false as const, message: "Post must be 1–5000 characters." }
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    const id = await ctx.db.insert("feedItems", {
      authorId: userId,
      authorUsername: profile?.username,
      ...args,
      status: "published",
      likeCount: 0, commentCount: 0, shareCount: 0, saveCount: 0, viewCount: 0,
      qualityScore: 0.5, velocityScore: 0,
      diversityKey: args.regionBucket ? `region:${args.regionBucket}` : "global",
    })
    const excludedIds = new Set<string>()
    const membership = await ctx.db.query("membershipProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    const tier = membership?.tier ?? "obsidian"
    const exclusionLimit = ["sovereign","sovereign_gilded","apex_imperial","sovereign_aethel"].includes(tier) ? 50 : 10
    if ((args.excludedUserIds ?? []).length > exclusionLimit) throw new Error("HIDE_FROM_LIMIT_EXCEEDED")
    if (tier !== "obsidian") await ctx.db.insert("sovereignPrivilegeAudit", { userId, tier, action: "used", feature: "post_exclusions", metadata: { count: (args.excludedUserIds ?? []).length }, createdAt: Date.now() })
    for (const excludedUserId of args.excludedUserIds ?? []) {
      excludedIds.add(String(excludedUserId))
      if (excludedUserId !== userId) await ctx.db.insert("postExclusions", { postId: id, ownerId: userId, excludedUserId, excludedListName: args.excludedListName })
    }
    for (const rawUsername of args.excludedUsernames ?? []) {
      const username = rawUsername.trim().replace(/^@/, "").toLowerCase()
      if (!username) continue
      const target = await ctx.db.query("userProfiles").withIndex("by_username_lower", q => q.eq("usernameLower", username)).unique()
      if (target && target.userId !== userId && !excludedIds.has(String(target.userId))) {
        await ctx.db.insert("postExclusions", { postId: id, ownerId: userId, excludedUserId: target.userId, excludedListName: args.excludedListName })
      }
    }
    for (const kind of args.excludedConnectionKinds ?? []) {
      await ctx.db.insert("postExclusions", { postId: id, ownerId: userId, excludedConnectionKind: kind, excludedListName: args.excludedListName })
    }
    return { ok: true as const, id }
  },
})

export const recordEvent = mutation({
  args: {
    itemId: v.id("feedItems"),
    event: v.union(v.literal("impression"), v.literal("view"), v.literal("like"), v.literal("comment"), v.literal("share"), v.literal("save"), v.literal("not_interested"), v.literal("follow")),
    dwellMs: v.optional(v.number()),
    sessionId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { itemId, event, dwellMs, sessionId }) => {
    const viewerId = await getAuthUserId(ctx)
    const item = await ctx.db.get(itemId)
    if (!item || item.status !== "published") return false
    const profile = viewerId ? await ctx.db.query("socialProfiles").withIndex("by_user", q => q.eq("userId", viewerId)).unique() : null
    await ctx.db.insert("feedEvents", {
      viewerId: viewerId ?? undefined,
      itemId,
      event,
      dwellMs,
      sessionId,
      regionBucket: profile?.region,
    })
    const field = event === "like" ? "likeCount" : event === "comment" ? "commentCount" : event === "share" ? "shareCount" : event === "save" ? "saveCount" : event === "view" ? "viewCount" : null
    if (field) await ctx.db.patch(itemId, { [field]: item[field] + 1 } as any)
    return true
  },
})

export const connect = mutation({
  args: { targetUserId: v.id("users"), kind: v.union(v.literal("follow"), v.literal("friend"), v.literal("blocked")) },
  returns: v.boolean(),
  handler: async (ctx, { targetUserId, kind }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId || userId === targetUserId) return false
    const existing = await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", userId).eq("targetUserId", targetUserId)).unique()
    if (existing) {
      await ctx.db.patch(existing._id, { kind, status: kind === "friend" ? "pending" : "active" })
      return true
    }
    await ctx.db.insert("socialConnections", { userId, targetUserId, kind, status: kind === "friend" ? "pending" : "active" })
    return true
  },
})

export const getFeed = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx)
    const profile = viewerId ? await ctx.db.query("socialProfiles").withIndex("by_user", q => q.eq("userId", viewerId)).unique() : null
    const taste = viewerId ? await ctx.db.query("tasteProfiles").withIndex("by_user", q => q.eq("userId", viewerId)).unique() : null
    let config = await ctx.db.query("algorithmConfigs").withIndex("by_name_active", q => q.eq("name", "evara_feed").eq("active", true)).unique()
    if (!config) config = { _id: "default" as any, _creationTime: 0, name: "evara_feed", version: 1, weights: DEFAULT_WEIGHTS, explorationRate: 0.09, updatedAt: Date.now(), active: true }
    const items = await ctx.db.query("feedItems").withIndex("by_status_created", q => q.eq("status", "published")).order("desc").take(60)
    const follows = viewerId ? await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", viewerId)).take(100) : []
    const followed = new Set(follows.filter(f => f.kind === "follow" || f.kind === "friend").map(f => String(f.targetUserId)))
    const viewerBlocked = new Set(follows.filter(f => f.kind === "blocked").map(f => String(f.targetUserId)))
    const allExclusions = new Map<string, any[]>()
    for (const item of items) {
      allExclusions.set(String(item._id), await ctx.db.query("postExclusions").withIndex("by_post", q => q.eq("postId", item._id)).take(200))
    }
    const visibleItems = items.filter(item => {
      if (item.authorId === viewerId) return true
      if (viewerBlocked.has(String(item.authorId))) return false
      if (item.visibility === "private" && item.authorId !== viewerId) return false
      if (item.visibility === "friends") {
        const connection = follows.find(f => String(f.targetUserId) === String(item.authorId) && (f.kind === "friend" || f.kind === "follow") && (f.status === "accepted" || f.status === "active"))
        if (!connection) return false
      }
      const exclusions = allExclusions.get(String(item._id)) ?? []
      if (exclusions.some(x => x.excludedUserId && String(x.excludedUserId) === String(viewerId))) return false
      if (exclusions.some(x => x.excludedConnectionKind && follows.some(f => f.kind === x.excludedConnectionKind && String(f.targetUserId) === String(item.authorId)))) return false
      return true
    })
    const interests = new Set<string>([
      ...((taste?.interests ?? []) as string[]),
      ...((taste?.categories ?? []) as string[]),
      ...((taste?.brands ?? []) as string[]),
    ])
    const w = { ...DEFAULT_WEIGHTS, ...(config.weights as Record<string, number>) }
    const ranked = visibleItems.map(item => {
      const affinity = interests.size && item.diversityKey ? (Array.from(interests).some(x => item.diversityKey?.toLowerCase().includes(x.toLowerCase())) ? 1 : 0.15) : 0.35
      const social = followed.has(String(item.authorId)) ? 1 : 0.15
      const location = profile?.region && item.regionBucket && profile.region === item.regionBucket ? 1 : 0.1
      const engagement = item.likeCount * 1 + item.commentCount * 2 + item.shareCount * 3 + item.saveCount * 2.5
      const quality = Math.min(1, item.qualityScore + Math.log1p(engagement) / 12)
      const velocity = Math.min(1, item.velocityScore + Math.min(1, engagement / 50))
      const explore = hash(`${item._id}:${viewerId ?? "guest"}:${config.version}`)
      const score =
        w.affinity * affinity +
        w.social * social +
        w.quality * quality +
        w.velocity * velocity +
        w.recency * recencyScore(item._creationTime) +
        w.location * location +
        w.exploration * explore
      return { ...item, score, viewerId }
    })
    ranked.sort((a, b) => b.score - a.score)
    return ranked.slice(0, 30)
  },
})

export const discoverPeople = query({
  args: { region: v.optional(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, { region }) => {
    const viewerId = await getAuthUserId(ctx)
    const profiles = region
      ? await ctx.db.query("socialProfiles").withIndex("by_region", q => q.eq("region", region).eq("discoveryEnabled", true)).take(30)
      : await ctx.db.query("socialProfiles").take(30)
    return profiles.filter(p => p.userId !== viewerId && p.discoveryEnabled && p.discoverableTo !== "nobody").map(p => ({
      ...p,
      city: p.locationMode === "city" ? p.city : undefined,
      region: p.locationMode !== "private" ? p.region : undefined,
    }))
  },
})

export const evolveAlgorithm = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const active = await ctx.db.query("algorithmConfigs").withIndex("by_name_active", q => q.eq("name", "evara_feed").eq("active", true)).unique()
    const base = active?.weights as Record<string, number> | undefined
    const events = await ctx.db.query("feedEvents").take(500)
    const positive = events.filter(e => ["view","like","comment","share","save"].includes(e.event)).length
    const negative = events.filter(e => e.event === "not_interested").length
    const satisfaction = positive / Math.max(1, positive + negative)
    const current = { ...DEFAULT_WEIGHTS, ...(base ?? {}) }
    const next = {
      ...current,
      affinity: Math.max(0.15, Math.min(0.40, current.affinity + (satisfaction - 0.5) * 0.02)),
      exploration: Math.max(0.05, Math.min(0.20, current.exploration + (0.55 - satisfaction) * 0.02)),
      velocity: Math.max(0.08, Math.min(0.22, current.velocity + (satisfaction - 0.5) * 0.015)),
    }
    const total = Object.values(next).reduce((a,b) => a+b, 0)
    for (const key of Object.keys(next)) next[key] /= total
    if (active) await ctx.db.patch(active._id, { active: false })
    await ctx.db.insert("algorithmConfigs", { name: "evara_feed", version: (active?.version ?? 0) + 1, weights: next, explorationRate: next.exploration, updatedAt: Date.now(), active: true })
    return null
  },
})

export const openDirectThread = mutation({
  args: { targetUserId: v.id("users") },
  returns: v.union(v.id("directThreads"), v.null()),
  handler: async (ctx, { targetUserId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId || userId === targetUserId) return null
    const targetProfile = await ctx.db.query("socialProfiles").withIndex("by_user", q => q.eq("userId", targetUserId)).unique()
    if (!targetProfile || !targetProfile.discoveryEnabled || targetProfile.discoverableTo === "nobody") return null
    const blocked = await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", userId).eq("targetUserId", targetUserId)).unique()
    const reverse = await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", targetUserId).eq("targetUserId", userId)).unique()
    if (blocked?.kind === "blocked" || reverse?.kind === "blocked") return null
    const a = String(userId) < String(targetUserId) ? userId : targetUserId
    const b = String(userId) < String(targetUserId) ? targetUserId : userId
    const existingA = await ctx.db.query("directThreads").withIndex("by_member_a", q => q.eq("memberA", a)).take(50)
    const existing = existingA.find(t => t.memberB === b)
    const threadId = existing?._id ?? await ctx.db.insert("directThreads", { memberA: a, memberB: b, lastMessageAt: Date.now(), status: "active" })
    const isFriend = blocked?.kind === "friend" && blocked.status === "accepted"
    if (!isFriend) {
      const pending = await ctx.db.query("messageRequests").withIndex("by_thread", q => q.eq("threadId", threadId)).take(20)
      const hasPending = pending.some(r => r.receiverId === targetUserId && r.senderId === userId && r.status === "pending")
      if (!hasPending) await ctx.db.insert("messageRequests", { threadId, senderId: userId, receiverId: targetUserId, status: "pending", createdAt: Date.now(), updatedAt: Date.now() })
    }
    return threadId
  },
})

export const listDirectThreads = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const [a, b] = await Promise.all([
      ctx.db.query("directThreads").withIndex("by_member_a", q => q.eq("memberA", userId)).take(50),
      ctx.db.query("directThreads").withIndex("by_member_b", q => q.eq("memberB", userId)).take(50),
    ])
    return [...a, ...b].sort((x, y) => y.lastMessageAt - x.lastMessageAt).slice(0, 50)
  },
})

export const listDirectMessages = query({
  args: { threadId: v.id("directThreads") },
  returns: v.array(v.any()),
  handler: async (ctx, { threadId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const thread = await ctx.db.get(threadId)
    if (!thread || (thread.memberA !== userId && thread.memberB !== userId) || thread.status === "blocked") return []
    return ctx.db.query("directMessages").withIndex("by_thread_created", q => q.eq("threadId", threadId)).order("asc").take(200)
  },
})

export const sendDirectMessage = mutation({
  args: { threadId: v.id("directThreads"), body: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), message: v.string() })),
  handler: async (ctx, { threadId, body }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, message: "Sign in required." }
    const text = body.trim()
    if (!text || text.length > 3000) return { ok: false as const, message: "Message must be 1–3000 characters." }
    const thread = await ctx.db.get(threadId)
    if (!thread || (thread.memberA !== userId && thread.memberB !== userId) || thread.status === "blocked") return { ok: false as const, message: "Conversation unavailable." }
    await ctx.db.insert("directMessages", { threadId, senderId: userId, body: text, createdAt: Date.now(), status: "sent" })
    await ctx.db.patch(thread._id, { lastMessageAt: Date.now() })
    return { ok: true as const }
  },
})


export const createStory = mutation({
  args: { mediaUrl: v.string(), mediaType: v.union(v.literal("image"), v.literal("video")), caption: v.optional(v.string()), visibility: v.union(v.literal("public"), v.literal("friends")) },
  returns: v.union(v.id("stories"), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    if (!args.mediaUrl.trim() || (args.caption && args.caption.length > 1000)) return null
    return ctx.db.insert("stories", { authorId: userId, ...args, mediaUrl: args.mediaUrl.trim(), expiresAt: Date.now() + 24 * 60 * 60 * 1000, status: "published" })
  },
})

export const listStories = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    const now = Date.now()
    const rows = await ctx.db.query("stories").withIndex("by_status_expiry", q => q.eq("status", "published")).take(200)
    const visible = rows.filter(s => s.expiresAt > now && (!userId || s.visibility === "public"))
    const authorIds = [...new Set(visible.map(s => String(s.authorId)))]
    const out:any[] = []
    for (const id of authorIds) {
      const group = visible.filter(s => String(s.authorId) === id).sort((a,b) => b._creationTime - a._creationTime)
      const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", group[0].authorId)).unique()
      out.push({ authorId: group[0].authorId, username: profile?.username, stories: group })
    }
    return out
  },
})

export const viewStory = mutation({
  args: { storyId: v.id("stories") },
  returns: v.boolean(),
  handler: async (ctx, { storyId }) => {
    const viewerId = await getAuthUserId(ctx)
    if (!viewerId) return false
    const story = await ctx.db.get(storyId)
    if (!story || story.status !== "published" || story.expiresAt <= Date.now()) return false
    const existing = await ctx.db.query("storyViews").withIndex("by_story_viewer", q => q.eq("storyId", storyId).eq("viewerId", viewerId)).unique()
    if (!existing) await ctx.db.insert("storyViews", { storyId, viewerId, viewedAt: Date.now() })
    return true
  },
})

export const listMyCircle = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const connections = await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId", userId)).take(200)
    const accepted = connections.filter(c => (c.kind === "friend" && c.status === "accepted") || (c.kind === "follow" && (c.status === "active" || c.status === "accepted")))
    const out:any[] = []
    for (const c of accepted) {
      const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", c.targetUserId)).unique()
      const social = await ctx.db.query("socialProfiles").withIndex("by_user", q => q.eq("userId", c.targetUserId)).unique()
      const membership = await ctx.db.query("membershipProfiles").withIndex("by_user", q => q.eq("userId", c.targetUserId)).unique()
      if (profile) out.push({userId:c.targetUserId, username:profile.username ?? "member", displayName:profile.displayName ?? profile.username ?? "Evara Member", tier:membership?.tier ?? "obsidian", bio:social?.bio, connectionKind:c.kind})
    }
    return out
  },
})

export const listFriendRequests = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const incoming = await ctx.db.query("socialConnections").withIndex("by_target_kind", q => q.eq("targetUserId", userId).eq("kind", "friend")).take(100)
    const out:any[] = []
    for (const c of incoming.filter(x => x.status === "pending")) {
      const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", c.userId)).unique()
      if (profile) out.push({connectionId:c._id,userId:c.userId,username:profile.username ?? "member",displayName:profile.displayName ?? profile.username ?? "Evara Member"})
    }
    return out
  },
})

export const respondToFriendRequest = mutation({
  args: { connectionId: v.id("socialConnections"), accept: v.boolean() }, returns: v.boolean(),
  handler: async (ctx, {connectionId, accept}) => {
    const userId = await getAuthUserId(ctx); if (!userId) return false
    const row = await ctx.db.get(connectionId)
    if (!row || row.targetUserId !== userId || row.kind !== "friend" || row.status !== "pending") return false
    if (!accept) { await ctx.db.delete(connectionId); return true }
    await ctx.db.patch(connectionId,{status:"accepted"})
    const reverse = await ctx.db.query("socialConnections").withIndex("by_user_target", q => q.eq("userId",userId).eq("targetUserId",row.userId)).unique()
    if (reverse && reverse.kind === "friend") await ctx.db.patch(reverse._id,{status:"accepted"})
    else await ctx.db.insert("socialConnections",{userId,targetUserId:row.userId,kind:"friend",status:"accepted"})
    return true
  },
})

export const getFriendProfile = query({
  args: { targetUserId: v.id("users") }, returns: v.union(v.any(), v.null()),
  handler: async (ctx,{targetUserId}) => {
    const viewerId=await getAuthUserId(ctx); if (!viewerId || viewerId===targetUserId) return null
    const profile=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",targetUserId)).unique(); if(!profile)return null
    const privacy=await ctx.db.query("privacySettings").withIndex("by_user",q=>q.eq("userId",targetUserId)).unique()
    const connection=await ctx.db.query("socialConnections").withIndex("by_user_target",q=>q.eq("userId",viewerId).eq("targetUserId",targetUserId)).unique()
    const isFriend=connection?.kind==="friend"&&connection.status==="accepted"
    if(privacy?.profileMode==="private"&&!isFriend)return {userId:targetUserId,username:profile.username??"member",displayName:profile.displayName??profile.username??"Evara Member",restricted:true}
    const membership=await ctx.db.query("membershipProfiles").withIndex("by_user",q=>q.eq("userId",targetUserId)).unique()
    const social=await ctx.db.query("socialProfiles").withIndex("by_user",q=>q.eq("userId",targetUserId)).unique()
    const posts=await ctx.db.query("feedItems").withIndex("by_author",q=>q.eq("authorId",targetUserId)).order("desc").take(12)
    const mine=await ctx.db.query("socialConnections").withIndex("by_user_target",q=>q.eq("userId",viewerId)).take(100)
    const mineIds=new Set(mine.filter(x=>x.kind==="friend"||x.kind==="follow").map(x=>String(x.targetUserId)))
    const target=await ctx.db.query("socialConnections").withIndex("by_user_target",q=>q.eq("userId",targetUserId)).take(100)
    const mutualCount=target.filter(x=>mineIds.has(String(x.targetUserId))).length
    return {userId:targetUserId,username:profile.username??"member",displayName:profile.displayName??profile.username??"Evara Member",tier:membership?.tier??"obsidian",points:membership?.points??0,bio:social?.bio,restricted:false,posts:posts.filter(p=>p.status==="published"),mutualCount}
  },
})

export const searchMembers = query({
  args: { search: v.string() }, returns: v.array(v.any()),
  handler: async (ctx,{search}) => {
    const userId=await getAuthUserId(ctx); if(!userId)return []
    const term=search.trim().toLowerCase(); if(!term)return []
    const profiles=await ctx.db.query("userProfiles").take(80); const results:any[]=[]
    for(const profile of profiles){
      if(profile.userId===userId)continue
      const haystack=(profile.username??"")+" "+(profile.displayName??"")
      if(!haystack.toLowerCase().includes(term))continue
      const social=await ctx.db.query("socialProfiles").withIndex("by_user",q=>q.eq("userId",profile.userId)).unique()
      if(social?.discoverableTo==="nobody")continue
      const membership=await ctx.db.query("membershipProfiles").withIndex("by_user",q=>q.eq("userId",profile.userId)).unique()
      results.push({userId:profile.userId,username:profile.username??"member",displayName:profile.displayName??profile.username??"Evara Member",tier:membership?.tier??"obsidian"})
      if(results.length>=20)break
    }
    return results
  },
})

export const listInbox = query({ args:{}, returns:v.array(v.any()), handler:async(ctx)=>{ const userId=await getAuthUserId(ctx); if(!userId)return []; const [a,b]=await Promise.all([ctx.db.query("directThreads").withIndex("by_member_a",q=>q.eq("memberA",userId)).take(100),ctx.db.query("directThreads").withIndex("by_member_b",q=>q.eq("memberB",userId)).take(100)]); const threads=[...a,...b].filter(t=>t.status==="active").sort((x,y)=>y.lastMessageAt-x.lastMessageAt); const pending=await ctx.db.query("messageRequests").withIndex("by_receiver_status",q=>q.eq("receiverId",userId).eq("status","pending")).take(100); const pendingIds=new Set(pending.map(r=>String(r.threadId))); const out:any[]=[]; for(const t of threads.filter(t=>!pendingIds.has(String(t._id)))){const other=t.memberA===userId?t.memberB:t.memberA; const p=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",other)).unique(); const m=await ctx.db.query("membershipProfiles").withIndex("by_user",q=>q.eq("userId",other)).unique(); const msgs=await ctx.db.query("directMessages").withIndex("by_thread_created",q=>q.eq("threadId",t._id)).order("desc").take(1); const c=await ctx.db.query("socialConnections").withIndex("by_user_target",q=>q.eq("userId",userId).eq("targetUserId",other)).unique(); out.push({threadId:t._id,otherUserId:other,username:p?.username??"member",displayName:p?.displayName??"Evara Member",tier:m?.tier??"obsidian",isFriend:c?.kind==="friend"&&c.status==="accepted",lastMessage:msgs[0]??null,lastMessageAt:t.lastMessageAt})} return out }})

export const listMessageRequests = query({ args:{}, returns:v.array(v.any()), handler:async(ctx)=>{const userId=await getAuthUserId(ctx);if(!userId)return [];const rows=await ctx.db.query("messageRequests").withIndex("by_receiver_status",q=>q.eq("receiverId",userId).eq("status","pending")).take(100);const out:any[]=[];for(const r of rows){const p=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",r.senderId)).unique();const m=await ctx.db.query("membershipProfiles").withIndex("by_user",q=>q.eq("userId",r.senderId)).unique();const msgs=await ctx.db.query("directMessages").withIndex("by_thread_created",q=>q.eq("threadId",r.threadId)).order("desc").take(1);out.push({requestId:r._id,threadId:r.threadId,userId:r.senderId,username:p?.username??"member",displayName:p?.displayName??"Evara Member",tier:m?.tier??"obsidian",preview:msgs[0]?.body??""})}return out}})

export const respondToMessageRequest = mutation({ args:{requestId:v.id("messageRequests"),action:v.union(v.literal("accept"),v.literal("ignore"),v.literal("block"),v.literal("report"))}, returns:v.boolean(), handler:async(ctx,{requestId,action})=>{const userId=await getAuthUserId(ctx);if(!userId)return false;const row=await ctx.db.get(requestId);if(!row||row.receiverId!==userId||row.status!=="pending")return false;const next=action==="accept"?"accepted":action==="ignore"?"ignored":action==="block"?"blocked":"reported";await ctx.db.patch(requestId,{status:next,updatedAt:Date.now()});if(action==="block"){const existing=await ctx.db.query("socialConnections").withIndex("by_user_target",q=>q.eq("userId",userId).eq("targetUserId",row.senderId)).unique();if(existing)await ctx.db.patch(existing._id,{kind:"blocked",status:"active"});else await ctx.db.insert("socialConnections",{userId,targetUserId:row.senderId,kind:"blocked",status:"active"});await ctx.db.patch(row.threadId,{status:"blocked"})}if(action==="report")await ctx.db.insert("reports",{reporterId:userId,targetType:"profile",targetId:String(row.senderId),reason:"other",details:"Message request reported from Inbox.",status:"open"});return true}})

export const setTyping = mutation({ args:{threadId:v.id("directThreads"),typing:v.boolean()}, returns:v.boolean(), handler:async(ctx,{threadId,typing})=>{const userId=await getAuthUserId(ctx);if(!userId)return false;const thread=await ctx.db.get(threadId);if(!thread||(thread.memberA!==userId&&thread.memberB!==userId))return false;const existing=await ctx.db.query("typingIndicators").withIndex("by_thread_user",q=>q.eq("threadId",threadId).eq("userId",userId)).unique();if(typing){if(existing)await ctx.db.patch(existing._id,{expiresAt:Date.now()+4000});else await ctx.db.insert("typingIndicators",{threadId,userId,expiresAt:Date.now()+4000})}else if(existing)await ctx.db.delete(existing._id);return true}})

export const getTypingUsers = query({ args:{threadId:v.id("directThreads")}, returns:v.array(v.id("users")), handler:async(ctx,{threadId})=>{const userId=await getAuthUserId(ctx);if(!userId)return [];const thread=await ctx.db.get(threadId);if(!thread||(thread.memberA!==userId&&thread.memberB!==userId))return [];const rows=await ctx.db.query("typingIndicators").withIndex("by_thread",q=>q.eq("threadId",threadId)).take(10);return rows.filter(r=>r.userId!==userId&&r.expiresAt>Date.now()).map(r=>r.userId)}})

export const listMyProfileDashboard = query({ args:{}, returns:v.union(v.any(),v.null()), handler:async(ctx)=>{const userId=await getAuthUserId(ctx);if(!userId)return null;const profile=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique();const membership=await ctx.db.query("membershipProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique();const privacy=await ctx.db.query("privacySettings").withIndex("by_user",q=>q.eq("userId",userId)).unique();const posts=await ctx.db.query("feedItems").withIndex("by_author",q=>q.eq("authorId",userId)).order("desc").take(60);return{profile,membership,privacy,posts}}})
