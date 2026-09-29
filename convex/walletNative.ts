import { v } from "convex/values"
import { internalMutation } from "./_generated/server"

export const debitForTransfer = internalMutation({
  args: {
    userId: v.id("users"),
    amountMinor: v.number(),
    reference: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, amountMinor, reference, reason }) => {
    const existing = await ctx.db.query("walletLedger").withIndex("by_user", q => q.eq("userId", userId)).take(100)
    if (existing.some((entry) => entry.reference === reference && entry.kind === "debit")) return null
    const wallet = await ctx.db.query("wallets").withIndex("by_user", q => q.eq("userId", userId)).unique()
    if (!wallet || wallet.status !== "active") throw new Error("WALLET_UNAVAILABLE")
    if (wallet.balanceMinor < BigInt(amountMinor)) throw new Error("INSUFFICIENT_WALLET_BALANCE")
    const next = wallet.balanceMinor - BigInt(amountMinor)
    await ctx.db.patch(wallet._id, { balanceMinor: next })
    await ctx.db.insert("walletLedger", {
      userId,
      kind: "debit",
      amountMinor,
      currency: wallet.currency,
      reason,
      reference,
      balanceAfterMinor: Number(next),
    })
    return null
  },
})
