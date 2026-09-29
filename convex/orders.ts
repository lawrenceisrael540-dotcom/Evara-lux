import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { mutation, query } from "./_generated/server"

const authResult = { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in required." }

// Creates the order in pending_payment status with server-revalidated prices
// and stock. Deliberately does NOT mark the order paid — there is no payment
// capture wired up yet (Paystack/wallet integration is separate follow-up
// work), and a fake "paid" status here would violate the "no fake
// implementation" rule. The UI must make clear that payment is the next step.
export const checkoutSubmit = mutation({
  args: {
    shippingAddress: v.any(),
    billingAddress: v.optional(v.any()),
    idempotencyKey: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), orderId: v.id("orders"), orderNumber: v.string() }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { shippingAddress, billingAddress, idempotencyKey }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return authResult

    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique()
    if (existingOrder) {
      return { ok: true as const, orderId: existingOrder._id, orderNumber: existingOrder.orderNumber }
    }

    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .unique()
    if (!cart) {
      return { ok: false as const, code: "EMPTY_CART", message: "Your cart is empty." }
    }
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect()
    if (cartItems.length === 0) {
      return { ok: false as const, code: "EMPTY_CART", message: "Your cart is empty." }
    }

    let subtotal = 0
    const lineItems: Array<{
      productId: any; variantId: any; productNameSnapshot: string;
      skuSnapshot: string | undefined; unitPriceMinor: number; quantity: number; lineTotalMinor: number;
    }> = []

    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId)
      if (!product || product.status !== "active") {
        return { ok: false as const, code: "PRODUCT_UNAVAILABLE", message: `${product?.name ?? "An item"} is no longer available.` }
      }
      let price = product.priceMinor
      let stock = product.stockQuantity
      if (item.variantId) {
        const variant = await ctx.db.get(item.variantId)
        if (!variant) {
          return { ok: false as const, code: "PRODUCT_UNAVAILABLE", message: "A variant in your cart is no longer available." }
        }
        price = variant.priceMinor ?? price
        stock = variant.stockQuantity
      }
      if (stock < item.quantity) {
        return { ok: false as const, code: "OUT_OF_STOCK", message: `Not enough stock for ${product.name}.` }
      }
      const lineTotal = price * item.quantity
      subtotal += lineTotal
      lineItems.push({
        productId: item.productId,
        variantId: item.variantId,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        unitPriceMinor: price,
        quantity: item.quantity,
        lineTotalMinor: lineTotal,
      })
    }

    const orderNumber = `EVR-${Date.now().toString(36).toUpperCase()}`

    const orderId = await ctx.db.insert("orders", {
      orderNumber,
      userId,
      status: "pending_payment",
      currency: cart.currency,
      subtotalMinor: subtotal,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: subtotal,
      shippingAddress,
      billingAddress,
      fulfillmentStatus: "unfulfilled",
      idempotencyKey,
    })

    for (const line of lineItems) {
      await ctx.db.insert("orderItems", { orderId, ...line })
    }

    await ctx.db.insert("orderStatusHistory", {
      orderId,
      toStatus: "pending_payment",
      reason: "order created, awaiting payment integration",
    })

    await ctx.db.patch(cart._id, { status: "converted" })

    await ctx.db.insert("accountActivity", {
      userId,
      kind: "order_placed",
      summary: `Order ${orderNumber} placed — ${lineItems.length} item${lineItems.length === 1 ? "" : "s"}`,
      relatedOrderId: orderId,
    })

    return { ok: true as const, orderId, orderNumber }
  },
})

const orderSummaryValidator = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  orderNumber: v.string(),
  status: v.string(),
  currency: v.string(),
  totalMinor: v.number(),
  fulfillmentStatus: v.string(),
})

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.union(
    v.object({ ok: v.literal(true), result: paginationResultValidator(orderSummaryValidator) }),
    v.object({ ok: v.literal(false), code: v.literal("UNAUTHENTICATED"), message: v.string() }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return authResult
    const result = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts)
    return {
      ok: true as const,
      result: {
        ...result,
        page: result.page.map((o) => ({
          _id: o._id,
          _creationTime: o._creationTime,
          orderNumber: o.orderNumber,
          status: o.status,
          currency: o.currency,
          totalMinor: o.totalMinor,
          fulfillmentStatus: o.fulfillmentStatus,
        })),
      },
    }
  },
})

export const getById = query({
  args: { orderId: v.id("orders") },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      order: v.any(),
      items: v.array(v.any()),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return authResult
    const order = await ctx.db.get(orderId)
    if (!order || order.userId !== userId) {
      return { ok: false as const, code: "NOT_FOUND", message: "Order not found." }
    }
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect()
    return { ok: true as const, order, items }
  },
})
