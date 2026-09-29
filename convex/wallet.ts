import { v } from "convex/values"
import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { withCustomer, rpc, selectRows, eq } from "./supabase"

// Money + NEXA Coins are authoritative on the native Convex ledger
// (coinsNative.ts -> wallets / coinAccounts). NEXA Points/tier remain
// authoritative in Supabase (evara_loyalty_accounts / evara_loyalty_tiers,
// the "Houses" system) — this action reads both and returns one combined
// snapshot for the account page. Deposit/withdraw stay UI-blocked until a
// funding flow is wired (see convex/paystack.ts's wallet-topup path).
export const getMySnapshot = action({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      balanceMinor: v.string(),
      currency: v.string(),
      pointsBalance: v.number(),
      lifetimePoints: v.number(),
      coinsBalance: v.number(),
      lifetimeCoins: v.number(),
    }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string(), traceId: v.string() }),
  ),
  handler: async (ctx) =>
    withCustomer(ctx, "wallet.snapshot", async (customer, traceId) => {
      const native = await ctx.runMutation(internal.coinsNative.ensureAndGetSnapshot, {})
      if (!native.ok) {
        throw new Error(native.code)
      }

      await rpc<string>("evara_loyalty_account_ensure", { p_customer: customer.customerId }, traceId)
      const loyalty = await selectRows<{ points_balance: string; lifetime_points: string }>(
        "evara_loyalty_accounts",
        { customer_id: eq(customer.customerId), select: "points_balance,lifetime_points", limit: "1" },
        traceId,
      )

      return {
        balanceMinor: native.balanceMinor,
        currency: native.currency,
        coinsBalance: native.coinsBalance,
        lifetimeCoins: native.lifetimeCoins,
        pointsBalance: Number(loyalty[0]?.points_balance ?? 0),
        lifetimePoints: Number(loyalty[0]?.lifetime_points ?? 0),
      }
    }),
})
