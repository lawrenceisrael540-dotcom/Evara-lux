import { v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"
import { resolveAuthors } from "./authz"
import type { Doc } from "./_generated/dataModel"

const MAX_BODY_LENGTH = 500
// Basic spam guard — no CAPTCHA/heuristics, just a per-account cooldown
// enforced server-side (not just disabling the button client-side).
const COMMENT_COOLDOWN_MS = 10_000
const NEGATIVE_SHIELD_TERMS = ["kill yourself", "kys", "idiot", "stupid", "moron", "worthless", "hate you"]

const commentValidator = v.object({
  _id: v.id("comments"),
  _creationTime: v.number(),
  postId: v.id("posts"),
  body: v.string(),
  authorUsername: v.string(),
  authorDisplayName: v.optional(v.string()),
  isMine: v.boolean(),
})

// Oldest-first within a post (default insertion order) — reads as a
// conversation, not a feed.
export const listForPost = query({
  args: { postId: v.id("posts"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(commentValidator),
  handler: async (ctx, { postId, paginationOpts }) => {
    const viewerId = await getAuthUserId(ctx)
    const result = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .paginate(paginationOpts)
    const post = await ctx.db.get(postId)
    const settings = post ? await ctx.db.query("privacySettings").withIndex("by_user", q => q.eq("userId", post.userId)).unique() : null
    const trusted = viewerId ? await ctx.db.query("privacyTrustedAccounts").withIndex("by_user_trusted", q => q.eq("userId", post?.userId ?? viewerId).eq("trustedUserId", viewerId)).unique() : null
    const visible = result.page.filter((c: Doc<"comments">) => {
      if (c.status !== "visible") return false
      if (!settings?.hideNegativeComments || trusted) return true
      const text = c.body.toLowerCase()
      return !NEGATIVE_SHIELD_TERMS.some(term => text.includes(term))
    })
    const authors = await resolveAuthors(ctx, visible.map((c: Doc<"comments">) => c.userId))
    return {
      ...result,
      page: visible.map((c: Doc<"comments">) => {
        const author = authors.get(c.userId.toString())
        return {
          _id: c._id,
          _creationTime: c._creationTime,
          postId: c.postId,
          body: c.body,
          authorUsername: author?.username ?? "member",
          authorDisplayName: author?.displayName,
          isMine: viewerId?.toString() === c.userId.toString(),
        }
      }),
    }
  },
})

export const add = mutation({
  args: { postId: v.id("posts"), body: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), id: v.id("comments") }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { postId, body }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const post = await ctx.db.get(postId)
    if (!post || post.status !== "visible") {
      return { ok: false as const, code: "NOT_FOUND", message: "That post is gone already." }
    }
    const trimmed = body.trim()
    if (!trimmed) return { ok: false as const, code: "EMPTY", message: "Write something first." }
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

    const lastComment = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first()
    if (lastComment) {
      const elapsed = Date.now() - lastComment._creationTime
      if (elapsed < COMMENT_COOLDOWN_MS) {
        const waitSec = Math.ceil((COMMENT_COOLDOWN_MS - elapsed) / 1000)
        return { ok: false as const, code: "RATE_LIMITED", message: `Wait ${waitSec}s before commenting again.` }
      }
    }

    const id = await ctx.db.insert("comments", { postId, userId, body: trimmed, status: "visible" })
    await ctx.db.patch(postId, { commentCount: post.commentCount + 1 })
    return { ok: true as const, id }
  },
})

export const remove = mutation({
  args: { commentId: v.id("comments") },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { commentId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const comment = await ctx.db.get(commentId)
    if (!comment) return { ok: false as const, code: "NOT_FOUND", message: "That comment is gone already." }
    if (comment.userId !== userId) return { ok: false as const, code: "FORBIDDEN", message: "That isn't your comment." }
    await ctx.db.delete(commentId)
    const post = await ctx.db.get(comment.postId)
    if (post) await ctx.db.patch(comment.postId, { commentCount: Math.max(0, post.commentCount - 1) })
    return { ok: true as const }
  },
})
