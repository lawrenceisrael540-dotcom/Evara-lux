import { v } from "convex/values"
import { action } from "./_generated/server"
import { withCustomer, rpc } from "./supabase"

// Read-only validation only. Returns the discount a code WOULD apply right
// now, with no side effects — safe to call on every keystroke/cart change.
//
// Redemption (evara_coupon_redeem) and referral rewards
// (evara_referral_reward_process) are intentionally NOT wired anywhere yet:
// both must only fire after real payment capture, and Convex orders
// (see orders.ts) have no payment-capture step wired up yet — checkoutSubmit
// creates orders as pending_payment and stops there. Wiring redemption in
// before that exists would mean granting discounts/rewards for orders that
// were never actually paid. Once the wallet-hold checkout path lands, call
// evara_coupon_redeem and evara_referral_reward_process at the same point
// the order transitions to paid — not before.
export const validateCoupon = action({
  args: { code: v.string(), subtotalMinor: v.number() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      valid: v.boolean(),
      reason: v.optional(v.string()),
      discountType: v.optional(v.string()),
      discountMinor: v.optional(v.number()),
      freeShipping: v.optional(v.boolean()),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string(), traceId: v.string() }),
  ),
  handler: async (ctx, { code, subtotalMinor }) =>
    withCustomer(ctx, "coupon.validate", async (customer, traceId) => {
      const result = await rpc<{
        valid: boolean
        code?: string
        coupon_id?: string
        discount_type?: string
        discount_minor?: number
        free_shipping?: boolean
      }>(
        "evara_coupon_validate",
        { p_code: code, p_customer: customer.customerId, p_subtotal_minor: subtotalMinor },
        traceId,
      )
      return {
        valid: result.valid,
        reason: result.code,
        discountType: result.discount_type,
        discountMinor: result.discount_minor,
        freeShipping: result.free_shipping,
      }
    }),
})
