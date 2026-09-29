import type { QueryCtx, MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

// The single source of truth for a member's privilege tier — backs Gilded
// customization gates (gilded.ts), social exclusion limits (social.ts),
// sovereign features (membership.ts), dungeon/party access (expeditions.tsx)
// and now the account page + AI Hub. Nothing else should gate a feature by
// tier: userProfiles.tier and loyaltyAccounts.tier (convex/account.ts) and
// the client-side "Houses" names (src/lib/evara-ecosystem/loyalty.ts) are
// legacy display artifacts only, kept for backward compatibility, never
// authoritative.
export const TIER_IDS = ["obsidian", "sovereign", "sovereign_gilded", "apex_imperial", "sovereign_aethel"] as const
export type TierId = (typeof TIER_IDS)[number]

export const TIER_RANK: Record<TierId, number> = {
  obsidian: 1,
  sovereign: 2,
  sovereign_gilded: 3,
  apex_imperial: 4,
  sovereign_aethel: 5,
}

// Matches the labels already shown in EvaraSocialHub.tsx (friends list,
// leaderboard, profile modal) — kept identical so the account page and AI
// Hub never introduce a second wording for the same tier.
export const TIER_LABEL: Record<TierId, string> = {
  obsidian: "Obsidian",
  sovereign: "Sovereign",
  sovereign_gilded: "Sovereign-Gilded",
  apex_imperial: "Apex-Imperial",
  sovereign_aethel: "Sovereign-Aethel",
}

export const DEFAULT_TIER: TierId = "obsidian"

function normalize(tier?: string | null): TierId {
  return (TIER_IDS as readonly string[]).includes(tier ?? "") ? (tier as TierId) : DEFAULT_TIER
}

export function tierRank(tier?: string | null): number {
  return TIER_RANK[normalize(tier)]
}

export function tierLabel(tier?: string | null): string {
  return TIER_LABEL[normalize(tier)]
}

export function hasTier(tier: string | undefined | null, minimum: TierId): boolean {
  return tierRank(tier) >= TIER_RANK[minimum]
}

// Looks up a user's real membership tier, defaulting to "obsidian" exactly
// like membership.ts/gilded.ts/social.ts already do for anyone who hasn't
// been assigned a membershipProfiles row yet (most members — the row is
// created lazily on first points award or explicit tier change).
export async function getMemberTier(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{ tier: TierId; label: string; rank: number; points: number }> {
  const row = await ctx.db
    .query("membershipProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  const tier = normalize(row?.tier)
  return { tier, label: TIER_LABEL[tier], rank: TIER_RANK[tier], points: row?.points ?? 0 }
}
