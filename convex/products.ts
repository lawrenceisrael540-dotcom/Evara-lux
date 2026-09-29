import { v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { mutation, query } from "./_generated/server"
import { api } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"

// Public-safe shape — costMinor, cjProductId and source are never returned
// to non-admin callers.
const publicProductValidator = v.object({
  _id: v.id("products"),
  _creationTime: v.number(),
  slug: v.string(),
  categoryId: v.id("categories"),
  name: v.string(),
  shortDescription: v.optional(v.string()),
  description: v.optional(v.string()),
  images: v.array(v.string()),
  priceMinor: v.number(),
  compareAtPriceMinor: v.optional(v.number()),
  currency: v.string(),
  inventoryStatus: v.union(
    v.literal("in_stock"),
    v.literal("low_stock"),
    v.literal("out_of_stock"),
    v.literal("discontinued"),
  ),
  attributes: v.optional(v.any()),
  specifications: v.optional(v.any()),
  rating: v.optional(v.number()),
  reviewCount: v.number(),
  featured: v.boolean(),
})

function toPublic(p: Doc<"products">) {
  return {
    _id: p._id,
    _creationTime: p._creationTime,
    slug: p.slug,
    categoryId: p.categoryId,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    images: p.images,
    priceMinor: p.priceMinor,
    compareAtPriceMinor: p.compareAtPriceMinor,
    currency: p.currency,
    inventoryStatus: p.inventoryStatus,
    attributes: p.attributes,
    specifications: p.specifications,
    rating: p.rating,
    reviewCount: p.reviewCount,
    featured: p.featured,
  }
}

export const listByCategory = query({
  args: { categoryId: v.id("categories"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(publicProductValidator),
  handler: async (ctx, { categoryId, paginationOpts }) => {
    const result = await ctx.db
      .query("products")
      .withIndex("by_category_status", (q) => q.eq("categoryId", categoryId).eq("status", "active"))
      .order("desc")
      .paginate(paginationOpts)
    return { ...result, page: result.page.map(toPublic) }
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(publicProductValidator, v.null()),
  handler: async (ctx, { slug }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
    if (!product || product.status !== "active") return null
    return toPublic(product)
  },
})

// Batch lookup for surfaces that hold a list of product ids and need display
// data in one round trip — the wishlist panel/page being the first caller.
// Silently drops ids that don't resolve to an active product (deleted,
// archived, or a stale id) rather than erroring the whole list.
export const getByIds = query({
  args: { ids: v.array(v.id("products")) },
  returns: v.array(publicProductValidator),
  handler: async (ctx, { ids }) => {
    const unique = [...new Set(ids)].slice(0, 100)
    const docs = await Promise.all(unique.map((id) => ctx.db.get(id)))
    return docs.filter((p): p is Doc<"products"> => p !== null && p.status === "active").map(toPublic)
  },
})

// Intentionally capped view for homepage "featured" rails — hiding older
// items is the desired product behavior here, not a routine CRUD list.
export const listFeatured = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(publicProductValidator),
  handler: async (ctx, { limit }) => {
    const items = await ctx.db
      .query("products")
      .withIndex("by_status_featured", (q) => q.eq("status", "active").eq("featured", true))
      .order("desc")
      .take(limit ?? 12)
    return items.map(toPublic)
  },
})

// Powers the navbar's product search, alongside authz.searchProfiles for
// people. Uses the search_name search index (fuzzy/typo-tolerant, ranked by
// relevance) rather than a prefix scan, since product names are longer and
// multi-word — "linen shirt" should find "Relaxed Linen Shirt". Filtered to
// active products inside the index itself, so drafts/archived items are
// never scanned, let alone returned. A query under 2 characters returns
// nothing rather than a broad, low-signal scan.
export const search = query({
  args: { text: v.string(), limit: v.optional(v.number()) },
  returns: v.array(publicProductValidator),
  handler: async (ctx, { text, limit }) => {
    const q = text.trim()
    if (q.length < 2) return []
    const cap = Math.max(1, Math.min(limit ?? 8, 20))
    const rows = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (s) => s.search("name", q).eq("status", "active"))
      .take(cap)
    return rows.map(toPublic)
  },
})

const forbidden = { ok: false as const, code: "FORBIDDEN" as const, message: "Admin access required." }

export const adminCreate = mutation({
  args: {
    slug: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
    shortDescription: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("cj")),
    cjProductId: v.optional(v.string()),
    sku: v.optional(v.string()),
    images: v.array(v.string()),
    priceMinor: v.number(),
    compareAtPriceMinor: v.optional(v.number()),
    costMinor: v.optional(v.number()),
    currency: v.string(),
    stockQuantity: v.number(),
    attributes: v.optional(v.any()),
    specifications: v.optional(v.any()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), id: v.id("products") }),
    v.object({ ok: v.literal(false), code: v.literal("FORBIDDEN"), message: v.string() }),
  ),
  handler: async (ctx, args) => {
    const isAdminUser: boolean = await ctx.runQuery(api.authz.isAdmin, {})
    if (!isAdminUser) return forbidden
    const id = await ctx.db.insert("products", {
      ...args,
      inventoryStatus: args.stockQuantity > 0 ? "in_stock" : "out_of_stock",
      reviewCount: 0,
      featured: false,
      status: "active",
    })
    return { ok: true as const, id }
  },
})

export const adminUpdateStock = mutation({
  args: { id: v.id("products"), stockQuantity: v.number() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.literal("FORBIDDEN"), message: v.string() }),
  ),
  handler: async (ctx, { id, stockQuantity }) => {
    const isAdminUser: boolean = await ctx.runQuery(api.authz.isAdmin, {})
    if (!isAdminUser) return forbidden
    await ctx.db.patch(id, {
      stockQuantity,
      inventoryStatus: stockQuantity > 0 ? "in_stock" : "out_of_stock",
    })
    return { ok: true as const }
  },
})
