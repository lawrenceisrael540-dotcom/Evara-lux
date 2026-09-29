"use node"
import { v } from "convex/values"
import { action, internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { getAuthUserId } from "@convex-dev/auth/server"

/**
 * CJ Dropshipping integration (API v2.0).
 *
 * Credentials: CJ_EMAIL + CJ_API_KEY live in Convex environment variables,
 * never in the database. The database only caches the *rotating* access/
 * refresh tokens those credentials mint (convex/schema.ts -> cjTokens),
 * because CJ's own auth endpoint is rate-limited to about one call per 5
 * minutes — hammering it on every request would get the whole account
 * throttled. Every function here is admin-gated: no customer-facing surface
 * calls this file directly.
 *
 * Docs: https://developers.cjdropshipping.com/en/api/api2/
 */

const BASE = "https://developers.cjdropshipping.com/api2.0/v1"
const AUTH_COOLDOWN_MS = 5 * 60 * 1000 // CJ allows ~1 getAccessToken call / 5 min
const TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000 // refresh an hour before expiry, not at the wire

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("Sign in required.")
  const isAdmin: boolean = await ctx.runQuery(internal.cj.checkIsAdminInternal, { userId })
  if (!isAdmin) throw new Error("Admin access required.")
}

/** Gets a live CJ-Access-Token, minting or refreshing one only when actually needed. */
async function getValidAccessToken(ctx: any): Promise<string> {
  const cached: {
    accessToken?: string
    accessTokenExpiresAt?: number
    refreshToken?: string
    refreshTokenExpiresAt?: number
    lastAuthAttemptAt?: number
  } | null = await ctx.runQuery(internal.cj.getCachedTokenInternal, {})

  const now = Date.now()
  if (cached?.accessToken && cached.accessTokenExpiresAt && cached.accessTokenExpiresAt - now > TOKEN_REFRESH_MARGIN_MS) {
    return cached.accessToken
  }

  const email = process.env.CJ_EMAIL
  const apiKey = process.env.CJ_API_KEY
  if (!email || !apiKey) {
    throw new Error("CJ_EMAIL and CJ_API_KEY environment variables are not set. Add them in the Convex dashboard under Settings -> Environment Variables.")
  }

  // Prefer refreshing over re-authenticating: it isn't subject to the same
  // 5-minute cooldown and doesn't risk CJ's per-account login rate limit.
  if (cached?.refreshToken && cached.refreshTokenExpiresAt && cached.refreshTokenExpiresAt > now) {
    const res = await fetch(`${BASE}/authentication/refreshAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: cached.refreshToken }),
    })
    const body = await res.json()
    if (body?.result && body?.data?.accessToken) {
      await ctx.runMutation(internal.cj.saveTokenInternal, {
        accessToken: body.data.accessToken,
        accessTokenExpiresAt: Date.parse(body.data.accessTokenExpiryDate),
        refreshToken: body.data.refreshToken,
        refreshTokenExpiresAt: Date.parse(body.data.refreshTokenExpiryDate),
      })
      return body.data.accessToken as string
    }
    // Refresh failed (expired/revoked) — fall through to a fresh login below.
  }

  if (cached?.lastAuthAttemptAt && now - cached.lastAuthAttemptAt < AUTH_COOLDOWN_MS) {
    throw new Error("CJ sign-in was attempted too recently. CJ allows roughly one login every 5 minutes — try again shortly.")
  }
  await ctx.runMutation(internal.cj.recordAuthAttemptInternal, {})

  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, apiKey }),
  })
  const body = await res.json()
  if (!body?.result || !body?.data?.accessToken) {
    throw new Error(`CJ sign-in failed: ${body?.message ?? "unknown error"} (code ${body?.code ?? "?"})`)
  }
  await ctx.runMutation(internal.cj.saveTokenInternal, {
    accessToken: body.data.accessToken,
    accessTokenExpiresAt: Date.parse(body.data.accessTokenExpiryDate),
    refreshToken: body.data.refreshToken,
    refreshTokenExpiresAt: Date.parse(body.data.refreshTokenExpiryDate),
  })
  return body.data.accessToken as string
}

async function cjGet(ctx: any, path: string, params: Record<string, string | number | undefined>) {
  const token = await getValidAccessToken(ctx)
  const qs = Object.entries(params)
    .filter(([, val]) => val !== undefined && val !== "")
    .map(([key, val]) => `${key}=${encodeURIComponent(String(val))}`)
    .join("&")
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "CJ-Access-Token": token },
  })
  const body = await res.json()
  if (!body?.result) throw new Error(`CJ API error on ${path}: ${body?.message ?? res.statusText} (code ${body?.code ?? res.status})`)
  return body.data
}

/* ---------------------------- public surface ---------------------------- */

export type CjSearchResult = {
  pid: string
  productName: string
  productImage: string
  sellPrice: string
  categoryName: string
}

/** Admin-only: search CJ's catalog. Does not write anything to our database. */
export const searchProducts = action({
  args: {
    keyword: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    pageNum: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    products: v.array(
      v.object({
        pid: v.string(),
        productName: v.string(),
        productImage: v.string(),
        sellPrice: v.string(),
        categoryName: v.string(),
      }),
    ),
    total: v.number(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    try {
      const data = await cjGet(ctx, "/product/list", {
        productNameEn: args.keyword,
        categoryId: args.categoryId,
        pageNum: args.pageNum ?? 1,
        pageSize: Math.min(args.pageSize ?? 20, 200), // CJ caps at 200/page
      })
      const list = (data?.list ?? []) as any[]
      return {
        ok: true,
        products: list.map((p) => ({
          pid: p.pid,
          productName: p.productNameEn ?? p.productName ?? "Untitled",
          productImage: p.productImage ?? "",
          sellPrice: String(p.sellPrice ?? ""),
          categoryName: p.categoryName ?? "",
        })),
        total: data?.total ?? list.length,
      }
    } catch (err: any) {
      return { ok: false, products: [], total: 0, message: String(err?.message ?? err) }
    }
  },
})

/**
 * Admin-only: imports one CJ product (with variants) into our own catalog.
 * priceMinor = supplier price * (1 + markupPercent/100), stored alongside
 * the raw supplier price and markup so a later resync can recompute
 * fairly instead of re-guessing a margin.
 */
export const importProduct = action({
  args: {
    cjProductId: v.string(),
    categoryId: v.id("categories"),
    markupPercent: v.number(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), productId: v.id("products") }),
    v.object({ ok: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, args): Promise<{ ok: true; productId: any } | { ok: false; message: string }> => {
    await requireAdmin(ctx)
    const userId = (await getAuthUserId(ctx))!
    if (args.markupPercent < 0 || args.markupPercent > 1000) {
      return { ok: false, message: "Markup must be between 0% and 1000%." }
    }
    try {
      const detail = await cjGet(ctx, "/product/query", { pid: args.cjProductId })
      const variantsRaw = await cjGet(ctx, "/product/variant/queryByPid", { pid: args.cjProductId })
      const supplierPriceMinor = Math.round(parseFloat(detail?.sellPrice ?? "0") * 100)
      const priceMinor = Math.round(supplierPriceMinor * (1 + args.markupPercent / 100))
      const images: string[] = (detail?.productImageSet ?? [detail?.productImage].filter(Boolean)) as string[]

      const productId = await ctx.runMutation(internal.cj.upsertImportedProductInternal, {
        cjProductId: args.cjProductId,
        categoryId: args.categoryId,
        name: detail?.productNameEn ?? detail?.productName ?? "Untitled CJ product",
        description: detail?.description ?? undefined,
        images: images.length ? images : [],
        priceMinor,
        supplierPriceMinor,
        markupPercent: args.markupPercent,
        stockQuantity: Number(detail?.remark ?? 0) || 0,
        variants: ((variantsRaw?.list ?? variantsRaw ?? []) as any[]).map((v2) => ({
          cjVariantId: String(v2.vid ?? v2.variantId ?? ""),
          sku: v2.variantSku ?? undefined,
          optionName: v2.variantNameEn ?? v2.variantKey ?? "Option",
          optionValue: v2.variantValue ?? v2.variantName ?? "Default",
          priceMinor: v2.variantSellPrice ? Math.round(parseFloat(v2.variantSellPrice) * 100 * (1 + args.markupPercent / 100)) : undefined,
          stockQuantity: Number(v2.variantStock ?? 0) || 0,
        })),
      })
      await ctx.runMutation(internal.cj.logImportInternal, {
        adminUserId: userId, cjProductId: args.cjProductId, productId, action: "import",
      })
      return { ok: true, productId }
    } catch (err: any) {
      await ctx.runMutation(internal.cj.logImportInternal, {
        adminUserId: userId, cjProductId: args.cjProductId, action: "failed", message: String(err?.message ?? err),
      })
      return { ok: false, message: String(err?.message ?? err) }
    }
  },
})

/** Admin-only: refreshes price/stock for an already-imported CJ product. */
export const resyncProduct = action({
  args: { productId: v.id("products") },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, { productId }): Promise<{ ok: true } | { ok: false; message: string }> => {
    await requireAdmin(ctx)
    const userId = (await getAuthUserId(ctx))!
    const product: any = await ctx.runQuery(internal.cj.getProductForResyncInternal, { productId })
    if (!product?.cjProductId) return { ok: false, message: "This product was not imported from CJ." }
    try {
      const detail = await cjGet(ctx, "/product/query", { pid: product.cjProductId })
      const supplierPriceMinor = Math.round(parseFloat(detail?.sellPrice ?? "0") * 100)
      const markup = product.cjMarkupPercent ?? 0
      const priceMinor = Math.round(supplierPriceMinor * (1 + markup / 100))
      await ctx.runMutation(internal.cj.applyResyncInternal, {
        productId,
        priceMinor,
        supplierPriceMinor,
        stockQuantity: Number(detail?.remark ?? product.stockQuantity) || product.stockQuantity,
      })
      await ctx.runMutation(internal.cj.logImportInternal, {
        adminUserId: userId, cjProductId: product.cjProductId, productId, action: "resync",
      })
      return { ok: true }
    } catch (err: any) {
      await ctx.runMutation(internal.cj.logImportInternal, {
        adminUserId: userId, cjProductId: product.cjProductId, productId, action: "failed", message: String(err?.message ?? err),
      })
      return { ok: false, message: String(err?.message ?? err) }
    }
  },
})
