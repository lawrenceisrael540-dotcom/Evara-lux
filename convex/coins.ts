import { v } from "convex/values"
import { action } from "./_generated/server"
import { withCustomer, rpc } from "./supabase"

// Placeholder exchange rate — 100 minor units (NGN 1.00) buys 1 NEXA Coin.
// Tune freely; nothing else depends on this specific number.
const MINOR_PER_COIN = 100

// The idempotency key is supplied by the CALLER (generated once client-side,
// e.g. crypto.randomUUID() when the purchase sheet opens), not derived here.
// Deriving it server-side from a fresh traceId would defeat the point: a
// network retry of the exact same user action needs to reuse the SAME key
// so evara_coin_purchase can recognize it as a replay instead of a second
// purchase. The caller should only mint a new key after a definitive
// success, or when the user explicitly changes the amount and tries again.
export const purchaseCoins = action({
  args: { coins: v.number(), idempotencyKey: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      purchased: v.boolean(),
      walletBalanceMinor: v.string(),
      coinsBalance: v.number(),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string(), traceId: v.string() }),
  ),
  handler: async (ctx, { coins, idempotencyKey }) =>
    withCustomer(ctx, "coins.purchase", async (customer, traceId) => {
      if (!Number.isInteger(coins) || coins <= 0) {
        throw new Error("INVALID_AMOUNT")
      }
      if (!idempotencyKey || idempotencyKey.length < 8) {
        throw new Error("INVALID_REQUEST")
      }
      const amountMinor = coins * MINOR_PER_COIN
      const result = await rpc<{ purchased: boolean; wallet_balance_minor: string; coins_balance: string }>(
        "evara_coin_purchase",
        {
          p_key: idempotencyKey,
          p_customer: customer.customerId,
          p_amount_minor: amountMinor,
          p_coins: coins,
          p_currency: "NGN",
        },
        traceId,
      )
      return {
        purchased: result.purchased,
        walletBalanceMinor: result.wallet_balance_minor,
        coinsBalance: Number(result.coins_balance),
      }
    }),
})
