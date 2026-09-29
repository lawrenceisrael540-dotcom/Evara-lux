import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"

export const listMine = query({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      productIds: v.array(v.id("products")),
    }),
    v.object({ ok: v.literal(false), code: v.literal("UNAUTHENTICATED"), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in to view your wishlist." }
    }
    const items = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    return { ok: true as const, productIds: items.map((i) => i.productId) }
  },
})

export const toggle = mutation({
  args: { productId: v.id("products") },
  returns: v.union(
    v.object({ ok: v.literal(true), inWishlist: v.boolean() }),
    v.object({ ok: v.literal(false), code: v.literal("UNAUTHENTICATED"), message: v.string() }),
  ),
  handler: async (ctx, { productId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in required." }
    }
    const existing = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user_product", (q) => q.eq("userId", userId).eq("productId", productId))
      .unique()
    const product = await ctx.db.get(productId)
    const productName = product?.name ?? "an item"
    if (existing) {
      await ctx.db.delete(existing._id)
      await ctx.db.insert("accountActivity", {
        userId,
        kind: "wishlist_removed",
        summary: `Removed ${productName} from wishlist`,
        relatedProductId: productId,
      })
      return { ok: true as const, inWishlist: false }
    }
    await ctx.db.insert("wishlistItems", { userId, productId })
    await ctx.db.insert("accountActivity", {
      userId,
      kind: "wishlist_added",
      summary: `Added ${productName} to wishlist`,
      relatedProductId: productId,
    })
    return { ok: true as const, inWishlist: true }
  },
})
