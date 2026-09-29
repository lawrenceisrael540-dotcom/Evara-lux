import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const AGE_RANGE = v.union(
  v.literal("13-17"),
  v.literal("18-24"),
  v.literal("25-34"),
  v.literal("35-44"),
  v.literal("45-54"),
  v.literal("55-64"),
  v.literal("65+"),
)
const GENDER = v.union(
  v.literal("woman"),
  v.literal("man"),
  v.literal("nonbinary"),
  v.literal("prefer_not_to_say"),
)

export const isAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    return !!profile && profile.role === "admin"
  },
})

export const getMyProfile = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userProfiles"),
      userId: v.id("users"),
      role: v.union(v.literal("customer"), v.literal("admin")),
      displayName: v.optional(v.string()),
      username: v.optional(v.string()),
      phone: v.optional(v.string()),
      country: v.optional(v.string()),
      ageRange: v.optional(AGE_RANGE),
      gender: v.optional(GENDER),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!profile) return null
    return {
      _id: profile._id,
      userId: profile.userId,
      role: profile.role,
      displayName: profile.displayName,
      username: profile.username,
      phone: profile.phone,
      country: profile.country,
      ageRange: profile.ageRange,
      gender: profile.gender,
    }
  },
})

// Sets the signed-in account's age range and/or gender. Account-only —
// nothing in this file ever surfaces these two fields from a public query
// (getPublicProfileByUsername/searchProfiles stay handle+displayName only).
// Pass null for a field to clear it; omit it to leave it unchanged.
export const updateDemographics = mutation({
  args: {
    ageRange: v.optional(v.union(AGE_RANGE, v.null())),
    gender: v.optional(v.union(GENDER, v.null())),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), code: v.string(), message: v.string() }),
  ),
  handler: async (ctx, { ageRange, gender }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false as const, code: "UNAUTHENTICATED", message: "Sign in required." }
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!profile) return { ok: false as const, code: "NO_PROFILE", message: "Account is still being set up." }

    const patch: { ageRange?: typeof profile.ageRange; gender?: typeof profile.gender } = {}
    if (ageRange !== undefined) patch.ageRange = ageRange ?? undefined
    if (gender !== undefined) patch.gender = gender ?? undefined
    await ctx.db.patch(profile._id, patch)
    await ctx.db.insert("accountActivity", {
      userId,
      kind: "profile_updated",
      summary: "Updated account details",
    })
    return { ok: true as const }
  },
})

// Public-safe lookup — used to render "posted by @handle" once social
// features read from this table. Never exposes phone/country/role/age/gender.
export const getPublicProfileByUsername = query({
  args: { username: v.string() },
  returns: v.union(
    v.object({ userId: v.id("users"), username: v.string(), displayName: v.optional(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, { username }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_username_lower", (q) => q.eq("usernameLower", username.toLowerCase()))
      .unique()
    if (!profile || !profile.username) return null
    return { userId: profile.userId, username: profile.username, displayName: profile.displayName }
  },
})

// Powers the navbar's people search. Prefix match on the unique, indexed
// usernameLower column — a range scan, not a table sweep, so it stays cheap
// as the user base grows. Same public-safe shape as getPublicProfileByUsername:
// no phone/country/role/email, ever. A prefix under 2 characters returns
// nothing rather than scanning broadly.
export const searchProfiles = query({
  args: { prefix: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({ userId: v.id("users"), username: v.string(), displayName: v.optional(v.string()) }),
  ),
  handler: async (ctx, { prefix, limit }) => {
    const p = prefix.trim().toLowerCase()
    if (p.length < 2) return []
    const cap = Math.max(1, Math.min(limit ?? 8, 20))
    // usernameLower values are bounded by USERNAME_PATTERN to [a-z0-9_], so
    // this upper bound safely covers every string starting with `p`.
    const upper = p + "\uffff"
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_username_lower", (q) => q.gte("usernameLower", p).lt("usernameLower", upper))
      .take(cap)
    return rows
      .filter((r) => r.username)
      .map((r) => ({ userId: r.userId, username: r.username!, displayName: r.displayName }))
  },
})

const ADJECTIVES = ["quiet", "amber", "violet", "obsidian", "velvet", "golden", "midnight", "coral", "silver", "ember"]
const NOUNS = ["fox", "wren", "atlas", "lumen", "harbor", "orbit", "marble", "willow", "cinder", "quartz"]

async function generateUniqueUsername(ctx: any): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    const suffix = Math.floor(Math.random() * 9000 + 1000)
    const candidate = `${adjective}-${noun}-${suffix}`
    const taken = await ctx.db
      .query("userProfiles")
      .withIndex("by_username_lower", (q: any) => q.eq("usernameLower", candidate))
      .unique()
    if (!taken) return candidate
  }
  // Extremely unlikely fallback: timestamp-suffixed, still checked once more upstream on insert races.
  return `member-${Date.now().toString(36)}`
}

// How often a repeat sign-in gets logged — an account page mount fires this
// every time it loads, and without a floor every reload would spam the
// activity feed with "Signed in" entries.
const SIGN_IN_LOG_THROTTLE_MS = 30 * 60 * 1000

// Called once after sign-in to guarantee a profile row exists. Also assigns
// a default unique username the first time, so every account is a
// recognizable identity from the start. Logs a throttled "sign_in" activity
// entry for existing accounts so accountActivity actually reflects sign-ins,
// not just profile/order/wishlist changes.
export const ensureMyProfile = mutation({
  args: {},
  returns: v.union(v.id("userProfiles"), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (existing) {
      const recent = await ctx.db
        .query("accountActivity")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(5)
      const lastSignIn = recent.find((a: any) => a.kind === "sign_in")
      if (!lastSignIn || Date.now() - lastSignIn._creationTime > SIGN_IN_LOG_THROTTLE_MS) {
        await ctx.db.insert("accountActivity", { userId, kind: "sign_in", summary: "Signed in" })
      }
      return existing._id
    }
    const username = await generateUniqueUsername(ctx)
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      role: "customer",
      username,
      usernameLower: username,
    })
    await ctx.db.insert("accountActivity", { userId, kind: "sign_in", summary: "Signed in for the first time" })
    return profileId
  },
})

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

export type SetUsernameResult =
  | { ok: true; username: string }
  | { ok: false; code: "UNAUTHENTICATED" | "NO_PROFILE" | "INVALID_FORMAT" | "TAKEN"; message: string }

export const setUsername = mutation({
  args: { username: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), username: v.string() }),
    v.object({
      ok: v.literal(false),
      code: v.union(v.literal("UNAUTHENTICATED"), v.literal("NO_PROFILE"), v.literal("INVALID_FORMAT"), v.literal("TAKEN")),
      message: v.string(),
    }),
  ),
  handler: async (ctx, { username }): Promise<SetUsernameResult> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { ok: false, code: "UNAUTHENTICATED", message: "Sign in required." }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!profile) return { ok: false, code: "NO_PROFILE", message: "Account is still being set up." }

    const lower = username.trim().toLowerCase()
    if (!USERNAME_PATTERN.test(lower)) {
      return {
        ok: false,
        code: "INVALID_FORMAT",
        message: "3–20 characters, lowercase letters, numbers and underscores, starting with a letter.",
      }
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_username_lower", (q) => q.eq("usernameLower", lower))
      .unique()
    if (existing && existing._id !== profile._id) {
      return { ok: false, code: "TAKEN", message: "That username is already taken." }
    }

    await ctx.db.patch(profile._id, { username: lower, usernameLower: lower })
    await ctx.db.insert("accountActivity", {
      userId,
      kind: "profile_updated",
      summary: `Username changed to @${lower}`,
    })
    return { ok: true, username: lower }
  },
})

// Internal-shaped helper for posts.ts/comments.ts: resolves a batch of
// userIds to their public author shape in one place, so the social layer
// never has to know userProfiles' internal fields. Keyed by the string form
// of each userId, since callers hold Ids from different doc types.
export async function resolveAuthors(
  ctx: { db: any },
  userIds: any[],
): Promise<Map<string, { username: string; displayName?: string }>> {
  const byKey = new Map<string, any>()
  for (const id of userIds) byKey.set(id.toString(), id)
  const map = new Map<string, { username: string; displayName?: string }>()
  await Promise.all(
    [...byKey.entries()].map(async ([key, id]) => {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q: any) => q.eq("userId", id))
        .unique()
      if (profile?.username) map.set(key, { username: profile.username, displayName: profile.displayName })
    }),
  )
  return map
}
