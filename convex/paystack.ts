import { action, internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { internal } from "./_generated/api"

const PAYSTACK_URL = "https://api.paystack.co"

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error("PAYSTACK_NOT_CONFIGURED")
  return key
}

async function paystack(path: string, init?: RequestInit) {
  const response = await fetch(PAYSTACK_URL + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const body = await response.json() as Record<string, any>
  if (!response.ok || body.status === false) {
    throw new Error(body.message || `Paystack request failed (${response.status})`)
  }
  return body
}

function reference(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 50)
}

export const getPaymentStatus = query({
  args: { reference: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), status: v.string(), authorizationUrl: v.union(v.string(), v.null()) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { reference: ref }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const payment = await ctx.db.query("payments").withIndex("by_reference", q => q.eq("reference", ref)).unique()
    if (!payment || payment.userId !== userId) return { ok: false as const, code: "NOT_FOUND", message: "Payment not found." }
    return { ok: true as const, status: payment.status, authorizationUrl: payment.authorizationUrl ?? null }
  },
})

export const createPayment = internalMutation({
  args: {
    userId: v.id("users"),
    orderId: v.optional(v.id("orders")),
    kind: v.union(v.literal("order"), v.literal("nexa"), v.literal("wallet_topup")),
    reference: v.string(),
    amountMinor: v.number(),
    currency: v.string(),
    metadata: v.optional(v.any()),
    authorizationUrl: v.optional(v.string()),
  },
  returns: v.id("payments"),
  handler: async (ctx, args) => ctx.db.insert("payments", {
    ...args,
    provider: "paystack",
    status: "initialized",
  }),
})

export const markPayment = internalMutation({
  args: { reference: v.string(), status: v.union(v.literal("pending"), v.literal("success"), v.literal("failed"), v.literal("refunded")), paidAt: v.optional(v.number()), metadata: v.optional(v.any()) },
  returns: v.null(),
  handler: async (ctx, { reference: ref, status, paidAt, metadata }) => {
    const payment = await ctx.db.query("payments").withIndex("by_reference", q => q.eq("reference", ref)).unique()
    if (!payment) return null
    if (payment.status === "success" && status === "success") return null
    await ctx.db.patch(payment._id, { status, ...(paidAt ? { paidAt } : {}), ...(metadata ? { metadata } : {}) })
    if (status === "success" && payment.kind === "wallet_topup") {
      const wallet = await ctx.db.query("wallets").withIndex("by_user", q => q.eq("userId", payment.userId)).unique()
      if (wallet) {
        const next = wallet.balanceMinor + BigInt(payment.amountMinor)
        await ctx.db.patch(wallet._id, { balanceMinor: next })
        await ctx.db.insert("walletLedger", { userId: payment.userId, kind: "credit", amountMinor: payment.amountMinor, currency: payment.currency, reason: "Paystack wallet top-up", reference: ref, balanceAfterMinor: Number(next) })
      }
    }
    if (status === "success" && payment.kind === "nexa") {
      const coins = Number((payment.metadata as any)?.coins ?? 0)
      if (coins > 0) {
        const account = await ctx.db.query("coinAccounts").withIndex("by_user", q => q.eq("userId", payment.userId)).unique()
        if (account) await ctx.db.patch(account._id, { balance: account.balance + coins, lifetimeCoins: account.lifetimeCoins + coins })
      }
    }
    if (status === "success" && payment.orderId) {
      const order = await ctx.db.get(payment.orderId)
      if (order && order.status === "pending_payment") {
        await ctx.db.patch(order._id, { status: "paid" })
        await ctx.db.insert("orderStatusHistory", { orderId: order._id, fromStatus: "pending_payment", toStatus: "paid", reason: "Paystack payment confirmed" })
        await ctx.db.insert("revenueEvents", { traceId: `paystack:${ref}`, orderId: order._id, amountMinor: BigInt(payment.amountMinor), currency: payment.currency, source: "paystack" })
      }
    }
    return null
  },
})

export const initializeOrderPayment = action({
  args: { orderId: v.id("orders"), callbackUrl: v.string() },
  returns: v.object({ ok: v.boolean(), reference: v.optional(v.string()), authorizationUrl: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { orderId, callbackUrl }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    const order = await ctx.runQuery(internal.paystack.getOrderForPayment, { orderId, userId })
    if (!order) return { ok: false, message: "Order not found." }
    if (order.status !== "pending_payment") return { ok: false, message: "This order is not awaiting payment." }
    const ref = reference("evar_order")
    const body = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: order.email,
        amount: order.totalMinor,
        currency: order.currency,
        reference: ref,
        callback_url: callbackUrl,
        metadata: { order_id: orderId, kind: "order", evara: "EVARA-LUX" },
      }),
    })
    await ctx.runMutation(internal.paystack.createPayment, {
      userId,
      orderId,
      kind: "order",
      reference: ref,
      amountMinor: order.totalMinor,
      currency: order.currency,
      metadata: { orderId, kind: "order" },
      authorizationUrl: body.data.authorization_url,
    })
    return { ok: true, reference: ref, authorizationUrl: body.data.authorization_url }
  },
})

export const initializeWalletTopup = action({
  args: { amountMinor: v.number(), callbackUrl: v.string() },
  returns: v.object({ ok: v.boolean(), reference: v.optional(v.string()), authorizationUrl: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { amountMinor, callbackUrl }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    if (!Number.isInteger(amountMinor) || amountMinor < 10000 || amountMinor > 5_000_000_00) return { ok: false, message: "Top-up must be between ₦100 and ₦5,000,000." }
    const identity = await ctx.auth.getUserIdentity()
    if (!identity?.email) return { ok: false, message: "A verified email is required for payment." }
    const ref = reference("evar_topup")
    const body = await paystack("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: identity.email, amount: amountMinor, currency: "NGN", reference: ref, callback_url: callbackUrl, metadata: { user_id: userId, kind: "wallet_topup", evara: "EVARA-LUX" } }) })
    await ctx.runMutation(internal.paystack.createPayment, { userId, kind: "wallet_topup", reference: ref, amountMinor, currency: "NGN", metadata: { userId, kind: "wallet_topup" }, authorizationUrl: body.data.authorization_url })
    return { ok: true, reference: ref, authorizationUrl: body.data.authorization_url }
  },
})

export const initializeNexaPayment = action({
  args: { coins: v.number(), callbackUrl: v.string() },
  returns: v.object({ ok: v.boolean(), reference: v.optional(v.string()), authorizationUrl: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { coins, callbackUrl }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    const packs: Record<number, number> = { 100: 1000, 550: 5000, 1200: 10000, 3000: 25000 }
    const amountMinor = packs[coins]
    if (!amountMinor) return { ok: false, message: "Invalid NEXA pack." }
    const identity = await ctx.auth.getUserIdentity()
    const email = identity?.email
    if (!email) return { ok: false, message: "A verified email is required for payment." }
    const ref = reference("evar_nexa")
    const body = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: amountMinor,
        currency: "NGN",
        reference: ref,
        callback_url: callbackUrl,
        metadata: { user_id: userId, kind: "nexa", coins, evara: "EVARA-LUX" },
      }),
    })
    await ctx.runMutation(internal.paystack.createPayment, {
      userId, kind: "nexa", reference: ref, amountMinor, currency: "NGN",
      metadata: { userId, kind: "nexa", coins }, authorizationUrl: body.data.authorization_url,
    })
    return { ok: true, reference: ref, authorizationUrl: body.data.authorization_url }
  },
})

export const verifyPayment = action({
  args: { reference: v.string() },
  returns: v.object({ ok: v.boolean(), status: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { reference: ref }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    const payment = await ctx.runQuery(internal.paystack.getPaymentForUser, { reference: ref, userId })
    if (!payment) return { ok: false, message: "Payment not found." }
    const body = await paystack(`/transaction/verify/${encodeURIComponent(ref)}`)
    const status = body.data?.status === "success" ? "success" : "pending"
    await ctx.runMutation(internal.paystack.markPayment, { reference: ref, status, paidAt: status === "success" ? Date.now() : undefined, metadata: body.data })
    return { ok: true, status }
  },
})

export const getOrderForPayment = internalQuery({
  args: { orderId: v.id("orders"), userId: v.id("users") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { orderId, userId }) => {
    const order = await ctx.db.get(orderId)
    if (!order || order.userId !== userId) return null
    const identity = await ctx.auth.getUserIdentity()
    return { ...order, email: identity?.email ?? "" }
  },
})

export const getPaymentForUser = internalQuery({
  args: { reference: v.string(), userId: v.id("users") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { reference: ref, userId }) => {
    const p = await ctx.db.query("payments").withIndex("by_reference", q => q.eq("reference", ref)).unique()
    return p && p.userId === userId ? p : null
  },
})

export const resolveAndAddBankRecipient = action({
  args: { bankCode: v.string(), accountNumber: v.string() },
  returns: v.object({ ok: v.boolean(), accountName: v.optional(v.string()), bankName: v.optional(v.string()), recipientCode: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { bankCode, accountNumber }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    if (!/^\d{10}$/.test(accountNumber)) return { ok: false, message: "Enter a valid 10-digit Nigerian account number." }
    const resolved = await paystack(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`)
    const accountName = resolved.data.account_name as string
    const banks = await paystack("/bank?country=nigeria&perPage=100")
    const bank = (banks.data as any[]).find((b) => String(b.code) === bankCode)
    const recipient = await paystack("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({ type: "nuban", name: accountName, account_number: accountNumber, bank_code: bankCode, currency: "NGN" }),
    })
    await ctx.runMutation(internal.paystack.saveBankRecipient, {
      userId, recipientCode: recipient.data.recipient_code, bankCode,
      bankName: bank?.name ?? "Nigerian bank", accountName,
      maskedAccountNumber: `••••${accountNumber.slice(-4)}`, currency: "NGN",
    })
    return { ok: true, accountName, bankName: bank?.name ?? "Nigerian bank", recipientCode: recipient.data.recipient_code }
  },
})

export const saveBankRecipient = internalMutation({
  args: { userId: v.id("users"), recipientCode: v.string(), bankCode: v.string(), bankName: v.string(), accountName: v.string(), maskedAccountNumber: v.string(), currency: v.string() },
  returns: v.id("bankRecipients"),
  handler: async (ctx, args) => ctx.db.insert("bankRecipients", { ...args, provider: "paystack", status: "active" }),
})

export const listMyBankRecipients = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db.query("bankRecipients").withIndex("by_user", q => q.eq("userId", userId)).order("desc").take(20)
  },
})

export const requestWalletTransfer = action({
  args: { recipientId: v.id("bankRecipients"), amountMinor: v.number(), reason: v.string(), twoFactorCode: v.optional(v.string()) },
  returns: v.object({ ok: v.boolean(), reference: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { recipientId, amountMinor, reason, twoFactorCode }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    if (amountMinor < 100) return { ok: false, message: "Minimum withdrawal is ₦1.00." }
    const recipient = await ctx.runQuery(internal.paystack.getRecipientForUser, { recipientId: recipientId, userId })
    if (!recipient) return { ok: false, message: "Bank recipient not found." }
    const security = await ctx.runQuery(internal.paystack.getSecurity, { userId })
    if (security?.twoFactorEnabled) {
      if (!twoFactorCode) return { ok: false, message: "2FA code required for bank withdrawals." }
      const valid = await ctx.runQuery(internal.paystack.verifyWithdrawalCode, { userId, code: twoFactorCode })
      if (!valid) return { ok: false, message: "Invalid 2FA code." }
    }
    const wallet = await ctx.runQuery(internal.paystack.getWalletForUser, { userId })
    if (!wallet || wallet.balanceMinor < BigInt(amountMinor)) return { ok: false, message: "Insufficient wallet balance." }
    const ref = reference("evar_transfer")
    const result = await paystack("/transfer", {
      method: "POST",
      body: JSON.stringify({ source: "balance", amount: amountMinor, recipient: recipient.recipientCode, reference: ref, reason, currency: "NGN" }),
    })
    await ctx.runMutation(internal.paystack.createTransfer, { userId, recipientId: recipientId, reference: ref, amountMinor: amountMinor, currency: "NGN", reason, status: result.data.status === "success" ? "success" : "pending" })
    await ctx.runMutation(internal.walletNative.debitForTransfer, { userId, amountMinor: amountMinor, reference: ref, reason })
    return { ok: true, reference: ref }
  },
})

export const getRecipientForUser = internalQuery({
  args: { recipientId: v.id("bankRecipients"), userId: v.id("users") }, returns: v.union(v.any(), v.null()),
  handler: async (ctx, { recipientId, userId }) => {
    const r = await ctx.db.get(recipientId); return r && r.userId === userId && r.status === "active" ? r : null
  },
})
export const getSecurity = internalQuery({
  args: { userId: v.id("users") }, returns: v.union(v.any(), v.null()),
  handler: async (ctx, { userId }) => ctx.db.query("userSecurity").withIndex("by_user", q => q.eq("userId", userId)).unique()
})
export const verifyWithdrawalCode = internalQuery({
  args: { userId: v.id("users"), code: v.string() }, returns: v.boolean(),
  handler: async (ctx, { userId, code }) => {
    const s = await ctx.db.query("userSecurity").withIndex("by_user", q => q.eq("userId", userId)).unique()
    if (!s?.twoFactorEnabled || !s.twoFactorSecret) return true
    const { verifyTotp } = await import("./totp")
    return verifyTotp(s.twoFactorSecret, code)
  },
})
export const getWalletForUser = internalQuery({
  args: { userId: v.id("users") }, returns: v.union(v.any(), v.null()),
  handler: async (ctx, { userId }) => ctx.db.query("wallets").withIndex("by_user", q => q.eq("userId", userId)).unique()
})
export const createTransfer = internalMutation({
  args: { userId: v.id("users"), recipientId: v.id("bankRecipients"), reference: v.string(), amountMinor: v.number(), currency: v.string(), reason: v.string(), status: v.union(v.literal("queued"), v.literal("pending"), v.literal("success"), v.literal("failed"), v.literal("reversed")) },
  returns: v.id("transfers"), handler: async (ctx, args) => ctx.db.insert("transfers", { provider: "paystack", ...args })
})

export const markTransfer = internalMutation({
  args: { reference: v.string(), status: v.union(v.literal("success"), v.literal("failed"), v.literal("reversed")) },
  returns: v.null(),
  handler: async (ctx, { reference, status }) => {
    const transfer = await ctx.db.query("transfers").withIndex("by_reference", q => q.eq("reference", reference)).unique()
    if (!transfer) return null
    await ctx.db.patch(transfer._id, { status })
    return null
  },
})
