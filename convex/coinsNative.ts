import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { internalMutation, mutation } from "./_generated/server"

// Placeholder exchange rate for wallet-funded purchases — NGN 1.00 (100
// minor units) per coin. Tune freely.
const MINOR_PER_COIN = 100
const WELCOME_BONUS_COINS = 500
const MONTHLY_PURCHASE_LIMIT = 2

/**
 * The native money+coin ledger, living entirely in Convex's own tables
 * (wallets / coinAccounts / coinGrants / walletLedger) — NOT Supabase. This
 * is deliberate: money and NEXA Coins are authoritative here; NEXA Points
 * and tier remain in Supabase (evara_loyalty_accounts / evara_loyalty_tiers,
 * the "Houses" system) and are read separately (see wallet.ts).
 */

async function ensureAccounts(ctx: any, userId: any) {
  let wallet = await ctx.db.query("wallets").withIndex("by_user", (q: any) => q.eq("userId", userId)).unique()
  if (!wallet) {
    const id = await ctx.db.insert("wallets", { userId, balanceMinor: 0n, currency: "NGN", status: "active" })
    wallet = await ctx.db.get(id)
  }

  let coinAccount = await ctx.db.query("coinAccounts").withIndex("by_user", (q: any) => q.eq("userId", userId)).unique()
  let justCreatedCoins = false
  if (!coinAccount) {
    const id = await ctx.db.insert("coinAccounts", { userId, balance: 0, lifetimeCoins: 0 })
    coinAccount = await ctx.db.get(id)
    justCreatedCoins = true
  }

  return { wallet, coinAccount, justCreatedCoins }
}

/** Idempotent credit to coinAccounts, logged to coinGrants for audit + replay safety. */
async function creditCoins(
  ctx: any,
  userId: any,
  amount: number,
  reason: "welcome_bonus" | "referral_referee" | "referral_referrer" | "tier_bonus" | "wallet_purchase" | "admin_adjustment",
  reference: string,
  orderId?: any,
) {
  const existing = await ctx.db.query("coinGrants").withIndex("by_reference", (q: any) => q.eq("reference", reference)).unique()
  if (existing) return { credited: false }

  const { coinAccount } = await ensureAccounts(ctx, userId)
  await ctx.db.patch(coinAccount._id, {
    balance: coinAccount.balance + amount,
    lifetimeCoins: coinAccount.lifetimeCoins + amount,
  })
  await ctx.db.insert("coinGrants", { userId, amount, reason, reference, orderId, createdAt: Date.now() })
  return { credited: true }
}

// Ensures accounts exist (granting the one-time welcome bonus on first-ever
// creation, atomically as part of the same insert) and returns the current
// money + coin balances. Safe to call on every account-page load.
export const ensureAndGetSnapshot = mutation({
  args: {},
  returns: v.union(
    v.object({ ok: v.literal(true), balanceMinor: v.string(), currency: v.string(), coinsBalance: v.number(), lifetimeCoins: v.number() }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const { wallet, coinAccount, justCreatedCoins } = await ensureAccounts(ctx, userId)
    if (justCreatedCoins) {
      // The welcome bonus IS this first-ever creation — no separate grant
      // call needed, so there's no window where a duplicate call could
      // double-credit it (ensureAccounts only inserts once; every call
      // after this one finds the row already there).
      await ctx.db.patch(coinAccount._id, { balance: WELCOME_BONUS_COINS, lifetimeCoins: WELCOME_BONUS_COINS })
      await ctx.db.insert("coinGrants", {
        userId, amount: WELCOME_BONUS_COINS, reason: "welcome_bonus",
        reference: `welcome:${userId}`, createdAt: Date.now(),
      })
      return { ok: true as const, balanceMinor: wallet!.balanceMinor.toString(), currency: wallet!.currency, coinsBalance: WELCOME_BONUS_COINS, lifetimeCoins: WELCOME_BONUS_COINS }
    }
    return {
      ok: true as const,
      balanceMinor: wallet!.balanceMinor.toString(),
      currency: wallet!.currency,
      coinsBalance: coinAccount!.balance,
      lifetimeCoins: coinAccount!.lifetimeCoins,
    }
  },
})

// Buys NEXA Coins by debiting the existing wallet balance directly (as
// opposed to paystack.ts's initializeNexaPayment, which charges a fresh
// Paystack payment for fixed packs). Both paths count toward the same
// monthly cap, checked against coinGrants + payments together.
export const purchaseCoinsFromWallet = mutation({
  args: { coins: v.number(), idempotencyKey: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), purchased: v.boolean(), balanceMinor: v.string(), coinsBalance: v.number() }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { coins, idempotencyKey }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    if (!Number.isInteger(coins) || coins <= 0) return { ok: false as const, code: "INVALID_AMOUNT", message: "Enter a whole number of coins." }
    if (!idempotencyKey || idempotencyKey.length < 8) return { ok: false as const, code: "INVALID_REQUEST", message: "Missing request key." }

    const reference = `coinpurchase:wallet:${idempotencyKey}`
    const existingGrant = await ctx.db.query("coinGrants").withIndex("by_reference", (q: any) => q.eq("reference", reference)).unique()
    const { wallet, coinAccount } = await ensureAccounts(ctx, userId)
    if (existingGrant) {
      // Replay of an already-processed purchase: return current state, no re-charge.
      const freshWallet = await ctx.db.get(wallet!._id)
      const freshCoins = await ctx.db.get(coinAccount!._id)
      return { ok: true as const, purchased: false, balanceMinor: freshWallet!.balanceMinor.toString(), coinsBalance: freshCoins!.balance }
    }

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const monthStartMs = monthStart.getTime()

    const recentGrants = await ctx.db.query("coinGrants").withIndex("by_user_created", (q: any) => q.eq("userId", userId).gte("createdAt", monthStartMs)).collect()
    const walletPurchasesThisMonth = recentGrants.filter((g: any) => g.reason === "wallet_purchase").length
    const paystackPurchasesThisMonth = await ctx.db
      .query("payments")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.and(q.eq(q.field("kind"), "nexa"), q.eq(q.field("status"), "success"), q.gte(q.field("paidAt"), monthStartMs)))
      .collect()
    if (walletPurchasesThisMonth + paystackPurchasesThisMonth.length >= MONTHLY_PURCHASE_LIMIT) {
      return { ok: false as const, code: "COIN_PURCHASE_LIMIT_REACHED", message: "You've reached this month's limit of 2 NEXA Coin purchases." }
    }

    const costMinor = BigInt(coins) * BigInt(MINOR_PER_COIN)
    if (wallet!.status !== "active") return { ok: false as const, code: "ACCOUNT_RESTRICTED", message: "Your wallet is not currently active." }
    if (wallet!.balanceMinor < costMinor) return { ok: false as const, code: "INSUFFICIENT_FUNDS", message: "Your wallet balance is too low." }

    const nextBalance = wallet!.balanceMinor - costMinor
    await ctx.db.patch(wallet!._id, { balanceMinor: nextBalance })
    await ctx.db.insert("walletLedger", {
      userId, kind: "debit", amountMinor: Number(costMinor), currency: wallet!.currency,
      reason: "NEXA Coin purchase", reference, balanceAfterMinor: Number(nextBalance),
    })
    const result = await creditCoins(ctx, userId, coins, "wallet_purchase", reference)
    const freshCoins = await ctx.db.get(coinAccount!._id)

    return { ok: true as const, purchased: result.credited, balanceMinor: nextBalance.toString(), coinsBalance: freshCoins!.balance }
  },
})

// Internal: grants referral-reward coins to both parties on a customer's
// first paid order. Called from orders.ts at the point an order actually
// transitions to paid (not at signup). Idempotent per order via coinGrants'
// unique reference.
export const grantReferralReward = internalMutation({
  args: { refereeUserId: v.id("users"), referrerUserId: v.id("users"), orderId: v.id("orders"), refereeAmount: v.number(), referrerAmount: v.number() },
  returns: v.null(),
  handler: async (ctx, { refereeUserId, referrerUserId, orderId, refereeAmount, referrerAmount }) => {
    await creditCoins(ctx, refereeUserId, refereeAmount, "referral_referee", `referral_referee:${orderId}`, orderId)
    await creditCoins(ctx, referrerUserId, referrerAmount, "referral_referrer", `referral_referrer:${orderId}`, orderId)
    return null
  },
})
