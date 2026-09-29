/**
 * EVARA-LUX loyalty tiers — the "Houses" system.
 *
 * Pure, client-safe, no money logic (see money.ts for that boundary). Tiers
 * are driven by NEXA Points earned, never by money spent directly, so
 * benefits can never be bought outright — only earned.
 *
 * This is presentation + progression math only. The live points balance
 * that decides someone's real tier comes from the wallet backend once it's
 * wired up (see the note in convex/ — wallet RPCs are still in security
 * review). Until then callers pass in whatever balance they have.
 */

export type TierId = "passage" | "signature" | "aureate" | "obsidian" | "lumen" | "monarch"

export interface TierTheme {
  /** Card background, deep to light. */
  gradient: [string, string, string]
  accent: string
  accentSoft: string
  foil: string
  emblem: string
}

export interface Tier {
  id: TierId
  name: string
  /** NEXA Points required to enter this tier. */
  threshold: number
  tagline: string
  benefits: readonly string[]
  /** Extra NEXA Coins earned per qualifying moment, as a multiplier on the base award. */
  coinMultiplier: number
  theme: TierTheme
}

export const TIERS: readonly Tier[] = [
  {
    id: "passage",
    name: "Passage",
    threshold: 0,
    tagline: "Where every account begins.",
    benefits: ["Standard NEXA Points on every order", "Weekly NEXA Moment eligibility", "Standard support"],
    coinMultiplier: 1,
    theme: {
      gradient: ["#141210", "#1d1a16", "#0c0b0a"],
      accent: "#C9A667",
      accentSoft: "#E4CFA0",
      foil: "rgba(245,241,232,0.14)",
      emblem: "◇",
    },
  },
  {
    id: "signature",
    name: "Signature",
    threshold: 2_000,
    tagline: "Recognised. A little more of everything.",
    benefits: ["+10% NEXA Points on every order", "Early access to select drops", "Priority support queue"],
    coinMultiplier: 1.15,
    theme: {
      gradient: ["#1c140f", "#2a1c12", "#120c08"],
      accent: "#D79A5E",
      accentSoft: "#EFC494",
      foil: "rgba(245,241,232,0.16)",
      emblem: "◈",
    },
  },
  {
    id: "aureate",
    name: "Aureate",
    threshold: 6_000,
    tagline: "Gold-standard. The collection opens wider.",
    benefits: ["+20% NEXA Points", "Aureate-only catalog access", "Free standard shipping", "Birthday NEXA Moment"],
    coinMultiplier: 1.3,
    theme: {
      gradient: ["#221a0c", "#332510", "#150f07"],
      accent: "#E6B54A",
      accentSoft: "#F7D986",
      foil: "rgba(255,231,168,0.22)",
      emblem: "✦",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    threshold: 15_000,
    tagline: "Quiet, deliberate, rare.",
    benefits: ["+35% NEXA Points", "Private preview of new collections", "Dedicated support line", "Card personalization unlocked"],
    coinMultiplier: 1.5,
    theme: {
      gradient: ["#0a0a0d", "#15131c", "#050508"],
      accent: "#8F8CFF",
      accentSoft: "#C6C4FF",
      foil: "rgba(180,178,255,0.2)",
      emblem: "◆",
    },
  },
  {
    id: "lumen",
    name: "Lumen",
    threshold: 35_000,
    tagline: "Radiant standing, seen the moment you arrive.",
    benefits: ["+50% NEXA Points", "Guided personal shopping", "Complimentary express shipping", "Lumen-exclusive drops"],
    coinMultiplier: 1.75,
    theme: {
      gradient: ["#161616", "#26241f", "#0c0c0b"],
      accent: "#E9E4D8",
      accentSoft: "#FFFFFF",
      foil: "rgba(255,255,255,0.3)",
      emblem: "☼",
    },
  },
  {
    id: "monarch",
    name: "Monarch",
    threshold: 80_000,
    tagline: "By invitation. The house at its fullest.",
    benefits: ["+75% NEXA Points", "A dedicated relationship lead", "First access to everything", "Bespoke card artwork"],
    coinMultiplier: 2,
    theme: {
      gradient: ["#1a0e14", "#2b1420", "#0f0810"],
      accent: "#E6A6C4",
      accentSoft: "#FFD9EA",
      foil: "rgba(255,214,235,0.24)",
      emblem: "♛",
    },
  },
] as const

export function tierForPoints(points: number): Tier {
  let current: Tier = TIERS[0]!
  for (const t of TIERS) if (points >= t.threshold) current = t
  return current
}

export function nextTier(current: TierId): Tier | null {
  const i = TIERS.findIndex((t) => t.id === current)
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1]! : null
}

export interface TierProgress {
  tier: Tier
  next: Tier | null
  /** 0–1. 1 when at the top tier. */
  progress: number
  pointsToNext: number | null
}

export function tierProgress(points: number): TierProgress {
  const tier = tierForPoints(points)
  const next = nextTier(tier.id)
  if (!next) return { tier, next: null, progress: 1, pointsToNext: null }
  const span = next.threshold - tier.threshold
  const into = points - tier.threshold
  return {
    tier,
    next,
    progress: span > 0 ? Math.max(0, Math.min(1, into / span)) : 1,
    pointsToNext: Math.max(0, next.threshold - points),
  }
}
