import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

const cartItemLineValidator = v.object({
  _id: v.id("cartItems"),
  productId: v.id("products"),
  variantId: v.union(v.id("productVariants"), v.null()),
  quantity: v.number(),
  unitPriceMinor: v.number(),
  productName: v.string(),
  productSlug: v.string(),
  productImage: v.union(v.string(), v.null()),
})

type CartItemLine = {
  _id: Id<"cartItems">
  productId: Id<"products">
  variantId: Id<"productVariants"> | null
  quantity: number
  unitPriceMinor: number
  productName: string
  productSlug: string
  productImage: string | null
}

export const getMyCart = query({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      cartId: v.union(v.id("carts"), v.null()),
      currency: v.string(),
      items: v.array(cartItemLineValidator),
      subtotalMinor: v.number(),
    }),
    v.object({ ok: v.literal(false), code: v.literal("UNAUTHENTICATED"), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in to view your cart." }
    }
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .unique()
    if (!cart) {
      return { ok: true as const, cartId: null, currency: "NGN", items: [], subtotalMinor: 0 }
    }
    const rawItems = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect()
    let subtotal = 0
    const items: CartItemLine[] = []
    for (const item of rawItems) {
      const product = await ctx.db.get(item.productId)
      if (!product) continue
      subtotal += item.unitPriceMinor * item.quantity
      items.push({
        _id: item._id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images[0] ?? null,
      })
    }
    return { ok: true as const, cartId: cart._id, currency: cart.currency, items, subtotalMinor: subtotal }
  },
})

async function ensureActiveCart(ctx: any, userId: any, currency: string) {
  const existing = await ctx.db
    .query("carts")
    .withIndex("by_user_status", (q: any) => q.eq("userId", userId).eq("status", "active"))
    .unique()
  if (existing) return existing._id
  return await ctx.db.insert("carts", { userId, status: "active", currency })
}

const authResult = { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in required." }

export const addItem = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { productId, variantId, quantity }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return authResult
    if (quantity <= 0) {
      return { ok: false as const, code: "INVALID_QUANTITY", message: "Quantity must be positive." }
    }

    const product = await ctx.db.get(productId)
    if (!product || product.status !== "active") {
      return { ok: false as const, code: "NOT_AVAILABLE", message: "Product is not available." }
    }

    let price = product.priceMinor
    let stock = product.stockQuantity
    if (variantId) {
      const variant = await ctx.db.get(variantId)
      if (!variant || variant.productId !== productId) {
        return { ok: false as const, code: "NOT_AVAILABLE", message: "Variant not found." }
      }
      price = variant.priceMinor ?? price
      stock = variant.stockQuantity
    }
    if (stock < quantity) {
      return { ok: false as const, code: "OUT_OF_STOCK", message: "Not enough stock available." }
    }

    const cartId = await ensureActiveCart(ctx, userId, product.currency)
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cartId))
      .filter((q) =>
        q.and(q.eq(q.field("productId"), productId), q.eq(q.field("variantId"), variantId)),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, { quantity: existing.quantity + quantity, unitPriceMinor: price })
    } else {
      await ctx.db.insert("cartItems", { cartId, productId, variantId, quantity, unitPriceMinor: price })
    }
    return { ok: true as const }
  },
})

export const setQuantity = mutation({
  args: { cartItemId: v.id("cartItems"), quantity: v.number() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { cartItemId, quantity }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return authResult

    const item = await ctx.db.get(cartItemId)
    if (!item) return { ok: false as const, code: "NOT_FOUND", message: "Cart item not found." }
    const cart = await ctx.db.get(item.cartId)
    if (!cart || cart.userId !== userId) {
      return { ok: false as const, code: "NOT_FOUND", message: "Cart item not found." }
    }

    if (quantity <= 0) {
      await ctx.db.delete(cartItemId)
    } else {
      await ctx.db.patch(cartItemId, { quantity })
    }
    return { ok: true as const }
  },
})
