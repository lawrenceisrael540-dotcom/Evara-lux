import { v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"
import { resolveAuthors } from "./authz"
import type { Doc } from "./_generated/dataModel"

const MAX_BODY_LENGTH = 2000
// Basic spam guard — no CAPTCHA/heuristics, just a per-account cooldown
// enforced server-side (not just disabling the button client-side).
const POST_COOLDOWN_MS = 30_000

const postValidator = v.object({
  _id: v.id("posts"),
  _creationTime: v.number(),
  body: v.string(),
  imageUrl: v.optional(v.string()),
  commentCount: v.number(),
  authorUsername: v.string(),
  authorDisplayName: v.optional(v.string()),
  isMine: v.boolean(),
})

async function toPublic(
  ctx: { db: any },
  post: Doc<"posts">,
  authors: Map<string, { username: string; displayName?: string }>,
  viewerId: string | null,
) {
  const author = authors.get(post.userId.toString())
  return {
    _id: post._id,
    _creationTime: post._creationTime,
    body: post.body,
    imageUrl: post.imageUrl,
    commentCount: post.commentCount,
    authorUsername: author?.username ?? "member",
    authorDisplayName: author?.displayName,
    isMine: viewerId === post.userId.toString(),
  }
}

// Recent-first public feed. status "visible" only — hidden posts (future
// moderation) never reach this query in the first place.
export const listFeed = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(postValidator),
  handler: async (ctx, { paginationOpts }) => {
    const viewerId = await getAuthUserId(ctx)
    const result = await ctx.db
      .query("posts")
      .withIndex("by_status", (q) => q.eq("status", "visible"))
      .order("desc")
      .paginate(paginationOpts)
    const authors = await resolveAuthors(ctx, result.page.map((p) => p.userId))
    return {
      ...result,
      page: await Promise.all(result.page.map((p) => toPublic(ctx, p, authors, viewerId?.toString() ?? null))),
    }
  },
})

// A single member's posts, for their public profile page (src/routes/u.$username.tsx).
export const listByUsername = query({
  args: { username: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(postValidator),
  handler: async (ctx, { username, paginationOpts }) => {
    const viewerId = await getAuthUserId(ctx)
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_username_lower", (q) => q.eq("usernameLower", username.toLowerCase()))
      .unique()
    if (!profile) return { page: [], isDone: true, continueCursor: "" }
    const result = await ctx.db
      .query("posts")
      .withIndex("by_user", (q) => q.eq("userId", profile.userId))
      .order("desc")
      .paginate(paginationOpts)
    const visible = result.page.filter((p: Doc<"posts">) => p.status === "visible" || viewerId === profile.userId)
    const authors = await resolveAuthors(ctx, visible.map((p: Doc<"posts">) => p.userId))
    return {
      ...result,
      page: await Promise.all(visible.map((p: Doc<"posts">) => toPublic(ctx, p, authors, viewerId?.toString() ?? null))),
    }
  },
})

export const create = mutation({
  args: { body: v.string(), imageUrl: v.optional(v.string()) },
  returns: v.union(
    v.object({ ok: v.literal(true), id: v.id("posts") }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { body, imageUrl }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const trimmed = body.trim()
    if (!trimmed) return { ok: false as const, code: "EMPTY", message: "Say something first." }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return { ok: false as const, code: "TOO_LONG", message: `Keep it under ${MAX_BODY_LENGTH} characters.` }
    }
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!profile?.username) {
      return { ok: false as const, code: "NO_PROFILE", message: "Finish setting up your account first." }
    }

    const lastPost = await ctx.db
      .query("posts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first()
    if (lastPost) {
      const elapsed = Date.now() - lastPost._creationTime
      if (elapsed < POST_COOLDOWN_MS) {
        const waitSec = Math.ceil((POST_COOLDOWN_MS - elapsed) / 1000)
        return { ok: false as const, code: "RATE_LIMITED", message: `Wait ${waitSec}s before posting again.` }
      }
    }

    const id = await ctx.db.insert("posts", {
      userId,
      body: trimmed,
      imageUrl,
      status: "visible",
      commentCount: 0,
    })
    return { ok: true as const, id }
  },
})

export const remove = mutation({
  args: { postId: v.id("posts") },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const post = await ctx.db.get(postId)
    if (!post) return { ok: false as const, code: "NOT_FOUND", message: "That post is gone already." }
    if (post.userId !== userId) return { ok: false as const, code: "FORBIDDEN", message: "That isn't your post." }
    await ctx.db.delete(postId)
    return { ok: true as const }
  },
})
