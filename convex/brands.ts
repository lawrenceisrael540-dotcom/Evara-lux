import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"

const PROSPECTS = [
  { name: "Apple", slug: "apple", website: "https://www.apple.com/", category: "Technology", integrationMode: "reseller" as const },
  { name: "Samsung", slug: "samsung", website: "https://www.samsung.com/", category: "Technology", integrationMode: "partner_api" as const },
  { name: "Amazon", slug: "amazon", website: "https://www.amazon.com/", category: "Marketplace", integrationMode: "affiliate" as const },
  { name: "Nike", slug: "nike", website: "https://www.nike.com/", category: "Fashion & Sport", integrationMode: "reseller" as const },
  { name: "Adidas", slug: "adidas", website: "https://www.adidas.com/", category: "Fashion & Sport", integrationMode: "reseller" as const },
  { name: "Sony", slug: "sony", website: "https://www.sony.com/", category: "Technology", integrationMode: "reseller" as const },
  { name: "Bose", slug: "bose", website: "https://www.bose.com/", category: "Audio", integrationMode: "reseller" as const },
  { name: "LVMH", slug: "lvmh", website: "https://www.lvmh.com/", category: "Luxury", integrationMode: "reseller" as const },
]

export const seedProspects = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return 0
    let created = 0
    for (const brand of PROSPECTS) {
      const existing = await ctx.db.query("brandPartners").withIndex("by_slug", q => q.eq("slug", brand.slug)).unique()
      if (!existing) {
        await ctx.db.insert("brandPartners", { ...brand, status: "prospect", country: "Global", notes: "Prospect record. No EVARA partnership is implied until authorization is approved." })
        created++
      }
    }
    return created
  },
})

export const listBrands = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => ctx.db.query("brandPartners").withIndex("by_status", q => q.eq("status", "active")).take(100),
})

export const listNetwork = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => ctx.db.query("brandPartners").take(100),
})

export const submitApplication = mutation({
  args: {
    name: v.string(),
    website: v.optional(v.string()),
    category: v.string(),
    requestedModel: v.union(v.literal("affiliate"), v.literal("catalog"), v.literal("wholesale"), v.literal("reseller"), v.literal("partner_api")),
    message: v.string(),
  },
  returns: v.union(v.object({ ok: v.literal(true), id: v.id("brandPartners") }), v.object({ ok: v.literal(false), message: v.string() })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, message: "Sign in required." }
    if (args.name.trim().length < 2 || args.message.trim().length < 10) return { ok: false as const, message: "Please provide the brand name and a useful partnership message." }
    const slug = args.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36)
    const id = await ctx.db.insert("brandPartners", { name: args.name.trim(), slug, website: args.website, category: args.category, status: "applied", integrationMode: args.requestedModel, notes: args.message.trim() })
    return { ok: true as const, id }
  },
})
