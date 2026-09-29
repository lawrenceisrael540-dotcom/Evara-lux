import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { api } from "./_generated/api"

const layoutVariantValidator = v.optional(
  v.union(
    v.literal("editorial"),
    v.literal("routine"),
    v.literal("specs"),
    v.literal("context"),
    v.literal("pairing"),
    v.literal("standard"),
  ),
)

const categoryValidator = v.object({
  _id: v.id("categories"),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  parentId: v.optional(v.id("categories")),
  description: v.optional(v.string()),
  themeConfig: v.optional(v.any()),
  status: v.union(v.literal("active"), v.literal("hidden"), v.literal("archived")),
  sortOrder: v.number(),
  cjCategoryId: v.optional(v.string()),
  heroImage: v.optional(v.string()),
  layoutVariant: layoutVariantValidator,
  merchandising: v.optional(v.any()),
  featuredProductIds: v.optional(v.array(v.id("products"))),
})

// Bounded, intentionally capped view — the category set is small and
// admin-curated, not user-generated content, so a fixed cap (not pagination)
// is the correct pattern here.
export const listActive = query({
  args: {},
  returns: v.array(categoryValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_status_sort", (q) => q.eq("status", "active"))
      .order("asc")
      .take(100)
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(categoryValidator, v.null()),
  handler: async (ctx, { slug }) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
    if (!category || category.status !== "active") return null
    return category
  },
})

const forbidden = { ok: false as const, code: "FORBIDDEN" as const, message: "Admin access required." }

export const adminCreate = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
    themeConfig: v.optional(v.any()),
    sortOrder: v.number(),
    cjCategoryId: v.optional(v.string()),
    heroImage: v.optional(v.string()),
    layoutVariant: layoutVariantValidator,
    merchandising: v.optional(v.any()),
    featuredProductIds: v.optional(v.array(v.id("products"))),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), id: v.id("categories") }),
    v.object({ ok: v.literal(false), code: v.literal("FORBIDDEN"), message: v.string() }),
  ),
  handler: async (ctx, args) => {
    const isAdminUser: boolean = await ctx.runQuery(api.authz.isAdmin, {})
    if (!isAdminUser) return forbidden
    const id = await ctx.db.insert("categories", { ...args, status: "active" })
    return { ok: true as const, id }
  },
})

export const adminUpdate = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    themeConfig: v.optional(v.any()),
    sortOrder: v.optional(v.number()),
    cjCategoryId: v.optional(v.string()),
    heroImage: v.optional(v.string()),
    layoutVariant: layoutVariantValidator,
    merchandising: v.optional(v.any()),
    featuredProductIds: v.optional(v.array(v.id("products"))),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.literal("FORBIDDEN"), message: v.string() }),
  ),
  handler: async (ctx, { id, ...patch }) => {
    const isAdminUser: boolean = await ctx.runQuery(api.authz.isAdmin, {})
    if (!isAdminUser) return forbidden
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
    await ctx.db.patch(id, clean)
    return { ok: true as const }
  },
})

export const adminSetStatus = mutation({
  args: {
    id: v.id("categories"),
    status: v.union(v.literal("active"), v.literal("hidden"), v.literal("archived")),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.literal("FORBIDDEN"), message: v.string() }),
  ),
  handler: async (ctx, { id, status }) => {
    const isAdminUser: boolean = await ctx.runQuery(api.authz.isAdmin, {})
    if (!isAdminUser) return forbidden
    await ctx.db.patch(id, { status })
    return { ok: true as const }
  },
})
