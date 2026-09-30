import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { api, internal } from "./_generated/api"
import { callAiJson } from "./aiProvider"
import { getMembershipTier, membershipTierLabel, membershipTierRank } from "./membershipLib"

const toolDefs = [
  {
    name: "search_catalog",
    description: "Search active EVARA-LUX products for shopping recommendations.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "discover_people",
    description: "Find discoverable EVARA members by a coarse city or region, never an exact location.",
    parameters: { type: "object", properties: { region: { type: "string" } }, required: [] },
  },
  {
    name: "search_brands",
    description: "Find EVARA brand-network records and their authorization status.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "get_recommendations",
    description: "Retrieve the member's current personalized product recommendations.",
    parameters: { type: "object", properties: { limit: { type: "number" } }, required: [] },
  },
  {
    name: "get_notifications",
    description: "Retrieve the member's latest EVARA house notifications.",
    parameters: { type: "object", properties: { limit: { type: "number" } }, required: [] },
  },
]

// Real, read-only reflection of toolDefs above for the AI Hub's Tool Console
// tab — one definition, not a second hand-copied list in the frontend. Drops
// the JSON-schema `parameters` since the console shows what a tool does, not
// its call signature.
export const listTools = query({
  args: {},
  returns: v.array(v.object({ name: v.string(), description: v.string() })),
  handler: async () => toolDefs.map(({ name, description }) => ({ name, description })),
})

export const createThread = mutation({
  args: { mode: v.union(v.literal("shopping"), v.literal("social"), v.literal("finance"), v.literal("general"), v.literal("admin")), title: v.optional(v.string()) },
  returns: v.id("aiThreads"),
  handler: async (ctx, { mode, title }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Sign in required.")
    return ctx.db.insert("aiThreads", { userId, mode, title: title ?? "EVARA Intelligence", updatedAt: Date.now() })
  },
})

export const listThreads = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return ctx.db.query("aiThreads").withIndex("by_user_updated", q => q.eq("userId", userId)).order("desc").take(30)
  },
})

export const listMessages = query({
  args: { threadId: v.id("aiThreads") },
  returns: v.array(v.any()),
  handler: async (ctx, { threadId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const thread = await ctx.db.get(threadId)
    if (!thread || thread.userId !== userId) return []
    return ctx.db.query("aiMessages").withIndex("by_thread_created", q => q.eq("threadId", threadId)).order("asc").take(100)
  },
})

export const saveUserMessage = internalMutation({
  args: { threadId: v.id("aiThreads"), userId: v.id("users"), content: v.string() },
  returns: v.id("aiMessages"),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== args.userId) throw new Error("THREAD_NOT_FOUND")
    const id = await ctx.db.insert("aiMessages", { threadId: args.threadId, userId: args.userId, role: "user", content: args.content, createdAt: Date.now() })
    await ctx.db.patch(thread._id, { updatedAt: Date.now() })
    return id
  },
})

export const saveAssistant = internalMutation({
  args: { threadId: v.id("aiThreads"), userId: v.id("users"), content: v.string(), model: v.optional(v.string()) },
  returns: v.id("aiMessages"),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== args.userId) throw new Error("THREAD_NOT_FOUND")
    const id = await ctx.db.insert("aiMessages", { threadId: args.threadId, userId: args.userId, role: "assistant", content: args.content, model: args.model, createdAt: Date.now() })
    await ctx.db.patch(thread._id, { updatedAt: Date.now() })
    return id
  },
})

export const getContext = internalQuery({
  args: { threadId: v.id("aiThreads"), userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, { threadId, userId }) => {
    const thread = await ctx.db.get(threadId)
    if (!thread || thread.userId !== userId) throw new Error("THREAD_NOT_FOUND")
    const messages = await ctx.db.query("aiMessages").withIndex("by_thread_created", q => q.eq("threadId", threadId)).order("asc").take(20)
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    const taste = await ctx.db.query("tasteProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
    // The member's real tier — see membershipLib.ts. profile.tier is a different, legacy field
    // and is never used for this; the system prompt below reads membership.tier, not profile.tier.
    const membership = await getMembershipTier(ctx, userId)
    return { thread, messages, profile, taste, membership }
  },
})

export const searchCatalog = internalQuery({
  args: { text: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, { text }) => {
    const q = text.trim()
    if (q.length < 2) return []
    return ctx.db.query("products").withSearchIndex("search_name", s => s.search("name", q).eq("status", "active")).take(8)
  },
})

export const searchRecommendations = internalQuery({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { userId, limit }) => {
    const rows = await ctx.db.query("recommendationItems").withIndex("by_user_score", q => q.eq("userId", userId)).order("desc").take(Math.min(Math.max(limit ?? 8, 1), 20))
    const out:any[] = []
    for (const row of rows) {
      if (row.expiresAt < Date.now()) continue
      const product = await ctx.db.get(row.productId)
      if (product?.status === "active") out.push({ productId: product._id, name: product.name, slug: product.slug, priceMinor: product.priceMinor, currency: product.currency, score: row.score, reason: row.reason })
    }
    return out
  },
})

export const getNotifications = internalQuery({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { userId, limit }) => ctx.db.query("notifications").withIndex("by_user_created", q => q.eq("userId", userId)).order("desc").take(Math.min(Math.max(limit ?? 8, 1), 20))
})

export const searchBrands = internalQuery({
  args: { text: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, { text }) => {
    const all = await ctx.db.query("brandPartners").take(50)
    const q = text.toLowerCase()
    return all.filter(b => b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)).slice(0, 10)
  },
})

export const startRun = internalMutation({
  args: { traceId: v.string(), userId: v.id("users"), task: v.string() },
  returns: v.id("aiRuns"),
  handler: async (ctx, args) => {
    await ctx.db.insert("traceEvents", { traceId: args.traceId, userId: args.userId, kind: "ai.request", status: "started", metadata: { task: args.task } })
    return ctx.db.insert("aiRuns", {
      traceId: args.traceId, userId: args.userId, agent: "evara-intelligence",
      task: args.task, status: "running", inputSummary: "member message", startedAt: Date.now(),
    })
  },
})

export const finishRun = internalMutation({
  args: { runId: v.id("aiRuns"), traceId: v.string(), userId: v.id("users"),
    status: v.union(v.literal("completed"), v.literal("failed")), model: v.optional(v.string()), outputSummary: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { status: args.status, model: args.model, outputSummary: args.outputSummary, completedAt: Date.now() })
    await ctx.db.insert("traceEvents", { traceId: args.traceId, userId: args.userId, kind: "ai.request", status: args.status === "completed" ? "completed" : "failed", metadata: { model: args.model } })
    return null
  },
})

export const sendMessage = action({
  args: { threadId: v.id("aiThreads"), message: v.string() },
  returns: v.object({ ok: v.boolean(), answer: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, { threadId, message }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, message: "Sign in required." }
    if (!message.trim() || message.length > 4000) return { ok: false, message: "Message must be 1–4000 characters." }

    await ctx.runMutation(internal.aiChat.saveUserMessage, { threadId, userId, content: message })
    const context = await ctx.runQuery(internal.aiChat.getContext, { threadId, userId })
    const system = `You are EVARA Intelligence, the conversational brain of EVARA-LUX.
You unify luxury shopping, social discovery, creator commerce, brand partnerships, wallet/payments guidance, NEXA utility, and customer support.
Never claim a brand is partnered with EVARA unless its record says active/verified.
Never expose private location, bank details, secrets, or hidden user data.
Location is coarse and consent-based only.
Explain recommendations when useful. For purchases, never say payment succeeded unless the backend confirms it.
Use concise but high-value responses and offer concrete next actions.
Current mode: ${context.thread.mode}.
Member tier: ${membershipTierLabel(context.membership?.tier)}.
Member interests/taste: ${JSON.stringify(context.taste ?? {})}.`

    const messages: any[] = [
      { role: "system", content: system },
      ...context.messages.map((m: any) => ({ role: m.role, content: m.content })),
    ]

    const tierRank = membershipTierRank(context.membership?.tier)
    const traceId = crypto.randomUUID()
    const runId = await ctx.runMutation(internal.aiChat.startRun, {
      traceId, userId, task: context.thread.mode,
    })

    let response
    try {
      response = await callAiJson({ rank: tierRank, temperature: 0.35, maxTokens: 900, messages, tools: toolDefs })
    } catch (error) {
      await ctx.runMutation(internal.aiChat.finishRun, {
        runId, traceId, userId, status: "failed",
        outputSummary: error instanceof Error ? error.message.slice(0, 200) : "provider failure",
      })
      throw error
    }

    for (let step = 0; step < 2 && response.finishReason === "tool-calls"; step++) {
      const calls = Array.isArray(response.toolCalls) ? response.toolCalls : []
      const toolResults: any[] = []
      for (const call of calls) {
        const input = (call as any).input ?? {}
        let output: unknown = { error: "Unknown tool." }
        if ((call as any).toolName === "search_catalog") output = await ctx.runQuery(internal.aiChat.searchCatalog, { text: String(input.query ?? "") })
        if ((call as any).toolName === "discover_people") output = await ctx.runQuery(api.social.discoverPeople, { region: input.region ? String(input.region) : undefined })
        if ((call as any).toolName === "search_brands") output = await ctx.runQuery(internal.aiChat.searchBrands, { text: String(input.query ?? "") })
        if ((call as any).toolName === "get_recommendations") output = await ctx.runQuery(internal.aiChat.searchRecommendations, { userId, limit: Number(input.limit ?? 8) })
        if ((call as any).toolName === "get_notifications") output = await ctx.runQuery(internal.aiChat.getNotifications, { userId, limit: Number(input.limit ?? 8) })
        toolResults.push({ type: "tool-result", toolCallId: (call as any).toolCallId, toolName: (call as any).toolName, output })
      }
      messages.push({ role: "assistant", content: calls.map((call: any) => ({ type: "tool-call", toolCallId: call.toolCallId, toolName: call.toolName, input: call.input })) })
      messages.push({ role: "tool", content: toolResults })
      response = await callAiJson({ rank: tierRank, temperature: 0.35, maxTokens: 900, messages, tools: toolDefs })
    }

    const answer = String(response.text ?? "I couldn't complete that request right now.")
    await ctx.runMutation(internal.aiChat.saveAssistant, { threadId, userId, content: answer, model: response.model ?? "configured-ai-model" })
    await ctx.runMutation(internal.aiChat.finishRun, {
      runId, traceId, userId, status: "completed", model: response.model, outputSummary: answer.slice(0, 300),
    })
    return { ok: true, answer }
  },
})
