import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { query } from "./_generated/server"

export const getMyOverview = query({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      orders: v.number(),
      wishlist: v.number(),
      posts: v.number(),
      activeProducts: v.number(),
      intelligenceSignals: v.number(),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const orders = await ctx.db.query("orders").withIndex("by_user", (q) => q.eq("userId", userId)).take(50)
    const wishlist = await ctx.db.query("wishlistItems").withIndex("by_user", (q) => q.eq("userId", userId)).take(50)
    const posts = await ctx.db.query("posts").withIndex("by_user", (q) => q.eq("userId", userId)).take(50)
    const activeProducts = await ctx.db.query("products").withIndex("by_status_featured", (q) => q.eq("status", "active")).take(50)
    const intelligenceSignals = await ctx.db.query("trends").withIndex("by_status_score", (q) => q.eq("status", "qualified")).take(25)
    return { ok: true as const, orders: orders.length, wishlist: wishlist.length, posts: posts.length, activeProducts: activeProducts.length, intelligenceSignals: intelligenceSignals.length }
  },
})

export const getAdminOverview = query({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      users: v.number(),
      products: v.number(),
      pendingOrders: v.number(),
      activeCampaigns: v.number(),
      qualifiedTrends: v.number(),
      aiRuns: v.number(),
      socialQueue: v.number(),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    if (!profile || profile.role !== "admin") return { ok: false as const, code: "FORBIDDEN", message: "Admin access required." }

    const users = await ctx.db.query("userProfiles").take(100)
    const products = await ctx.db.query("products").withIndex("by_status_featured", (q) => q.eq("status", "active")).take(100)
    const pendingOrders = await ctx.db.query("orders").withIndex("by_status", (q) => q.eq("status", "pending_payment")).take(50)
    const activeCampaigns = await ctx.db.query("campaigns").withIndex("by_status", (q) => q.eq("status", "active")).take(50)
    const qualifiedTrends = await ctx.db.query("trends").withIndex("by_status_score", (q) => q.eq("status", "qualified")).take(50)
    const aiRuns = await ctx.db.query("aiRuns").withIndex("by_status", (q) => q.eq("status", "running")).take(50)
    const socialQueue = await ctx.db.query("socialPosts").withIndex("by_platform_status", (q) => q.eq("platform", "instagram").eq("status", "scheduled")).take(50)

    return { ok: true as const, users: users.length, products: products.length, pendingOrders: pendingOrders.length, activeCampaigns: activeCampaigns.length, qualifiedTrends: qualifiedTrends.length, aiRuns: aiRuns.length, socialQueue: socialQueue.length }
  },
})
