/**
 * Shared source of truth for a member's EVARA-LUX membership tier.
 *
 * membershipProfiles.tier is the one place tier status is decided. Every tier-gated feature is
 * supposed to read it from here (or an equivalent query against the same table) — gilded.ts's
 * Sovereign-Gilded console, membership.ts's own point multipliers and privilege audit, etc.
 * already do. Two places had drifted onto a different table instead, each with its own,
 * unrelated tier naming:
 *
 *   - account.ts's getMySnapshot/ensureMyAccount were returning userProfiles.tier /
 *     loyaltyAccounts.tier — a separate, spend-threshold rewards ladder ("Passage" /
 *     "Signature" / "Sovereign" / "Imperial" / "Evara") that has nothing to do with membership
 *     tier. A real Sovereign-Gilded or Apex-Imperial member would see "Passage" on their own
 *     account page.
 *   - aiChat.ts's getContext was doing the same for the AI concierge's system prompt, so the
 *     assistant would describe a high-tier member as "Passage" too.
 *
 * Both now read through here. The loyalty-points ladder itself (loyaltyAccounts, TIERS/tierFor
 * in account.ts) is left alone — it is a legitimate, separate concept (a spend-based rewards
 * ladder), just not "the member's tier" for display or gating purposes.
 *
 * NOT fixed here, on purpose: membership.setMyTier lets a signed-in user self-assign
 * "sovereign_gilded" with no points requirement — only apex_imperial/sovereign_aethel are
 * invitation-gated. That's a real gap, but a business-rule decision about what should gate
 * sovereign_gilded, not a tier-unification bug, so it's left for an explicit call rather than
 * silently changed here.
 */
export const MEMBERSHIP_TIERS = ["obsidian", "sovereign", "sovereign_gilded", "apex_imperial", "sovereign_aethel"] as const
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number]
export const DEFAULT_MEMBERSHIP_TIER: MembershipTier = "obsidian"

const TIER_RANK: Record<string, number> = {
  obsidian: 1,
  sovereign: 2,
  sovereign_gilded: 3,
  apex_imperial: 4,
  sovereign_aethel: 5,
}

const TIER_LABEL: Record<MembershipTier, string> = {
  obsidian: "Obsidian Member",
  sovereign: "Sovereign Member",
  sovereign_gilded: "Sovereign-Gilded Member",
  apex_imperial: "Apex-Imperial Member",
  sovereign_aethel: "Sovereign-Aethel Member",
}

export function membershipTierRank(tier: string | undefined): number {
  return TIER_RANK[tier ?? DEFAULT_MEMBERSHIP_TIER] ?? 1
}

export function hasMembershipTier(tier: string | undefined, minimum: MembershipTier): boolean {
  return membershipTierRank(tier) >= (TIER_RANK[minimum] ?? 1)
}

export function membershipTierLabel(tier: string | undefined): string {
  return TIER_LABEL[(tier as MembershipTier) ?? DEFAULT_MEMBERSHIP_TIER] ?? TIER_LABEL[DEFAULT_MEMBERSHIP_TIER]
}

/** Raw membershipProfiles row for a user, or null if one has never been created for them. */
export async function getMembershipRow(ctx: any, userId: any) {
  return await ctx.db
    .query("membershipProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique()
}

/** The canonical tier + points for a user. Never null — an absent row just means the untouched default. */
export async function getMembershipTier(ctx: any, userId: any): Promise<{ tier: MembershipTier; points: number }> {
  const row = await getMembershipRow(ctx, userId)
  return { tier: (row?.tier as MembershipTier) ?? DEFAULT_MEMBERSHIP_TIER, points: row?.points ?? 0 }
}
