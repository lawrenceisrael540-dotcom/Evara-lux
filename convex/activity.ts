import { v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { query } from "./_generated/server"

// Read-only window onto accountActivity (see schema.ts) — the "everything
// happening on this account" log. Writers live where the events actually
// occur: authz.ts (username/profile changes, sign-in), orders.ts (order
// placed), wishlist.ts (added/removed). This file never writes, only reads
// the signed-in user's own rows back to them.
const activityValidator = v.object({
  _id: v.id("accountActivity"),
  _creationTime: v.number(),
  kind: v.union(
    v.literal("order_placed"),
    v.literal("order_status_changed"),
    v.literal("wishlist_added"),
    v.literal("wishlist_removed"),
    v.literal("profile_updated"),
    v.literal("sign_in"),
  ),
  summary: v.string(),
  relatedOrderId: v.optional(v.id("orders")),
  relatedProductId: v.optional(v.id("products")),
})

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.union(
    v.object({ ok: v.literal(true), result: paginationResultValidator(activityValidator) }),
    v.object({ ok: v.literal(false), code: v.literal("UNAUTHENTICATED"), message: v.string() }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return { ok: false as const, code: "UNAUTHENTICATED" as const, message: "Sign in required." }
    }
    const result = await ctx.db
      .query("accountActivity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts)
    return { ok: true as const, result }
  },
})
