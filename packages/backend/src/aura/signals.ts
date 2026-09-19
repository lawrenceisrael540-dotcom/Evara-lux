import { getSupabaseAdmin } from "../db/supabase.js";

/**
 * How fast a signal's weight decays. A tag mentioned today counts fully;
 * one from 3 half-lives ago counts for ~1/8. This is what makes "one random
 * search" harmless (it decays to near-zero within weeks) while a genuinely
 * recurring interest stays visible. Tunable later via evara_config if it
 * needs to differ per event type.
 */
const HALF_LIFE_DAYS = 21;

/** Different event types carry different evidentiary weight per occurrence. */
const EVENT_BASE_WEIGHT: Record<string, number> = {
  PRODUCT_VIEWED: 1,
  PRODUCT_ADDED_TO_CART: 3,
  ORDER_PAID: 6,
  // Wishlist adds are read separately (evara_wishlist_items), not via
  // evara_customer_events — see fetchWishlistTagCounts below.
};

export interface TagWeight {
  tag: string;
  weight: number;
  occurrences: number;
}

function decayWeight(ageDays: number, baseWeight: number): number {
  return baseWeight * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/**
 * Reads evara_customer_events for behavioral signals and evara_wishlist_items
 * for standing interest, and returns a decayed, aggregated tag-weight map.
 * Tags come from event payload.tags / payload.category — whatever the
 * catalog side actually populates; unknown/missing tags are skipped rather
 * than guessed at.
 */
export async function computeTagWeights(customerId: string): Promise<TagWeight[]> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const totals = new Map<string, { weight: number; occurrences: number }>();

  const { data: events, error } = await supabase
    .from("evara_customer_events")
    .select("event_type, payload, created_at")
    .eq("customer_id", customerId)
    .in("event_type", Object.keys(EVENT_BASE_WEIGHT))
    .order("created_at", { ascending: false })
    .limit(500); // recent history is what matters; a very old event has decayed to ~nothing anyway

  if (error) throw new Error(`computeTagWeights: failed to read customer events: ${error.message}`);

  for (const ev of events ?? []) {
    const base = EVENT_BASE_WEIGHT[ev.event_type as string] ?? 0;
    if (base === 0) continue;
    const ageDays = (now - new Date(ev.created_at as string).getTime()) / 86_400_000;
    const w = decayWeight(ageDays, base);
    const tags = extractTags(ev.payload as Record<string, unknown>);
    for (const tag of tags) {
      const cur = totals.get(tag) ?? { weight: 0, occurrences: 0 };
      cur.weight += w;
      cur.occurrences += 1;
      totals.set(tag, cur);
    }
  }

  // Wishlist items are standing interest, not a timestamped event stream in
  // this schema — treat each active item as a fixed, undecaying signal at a
  // modest weight, since "still on the wishlist" already implies recency
  // isn't the point.
  const { data: wishlist, error: wishlistError } = await supabase
    .from("evara_wishlist_items")
    .select("metadata")
    .eq("customer_id", customerId);

  if (wishlistError) throw new Error(`computeTagWeights: failed to read wishlist: ${wishlistError.message}`);

  for (const item of wishlist ?? []) {
    const tags = extractTags(item.metadata as Record<string, unknown> | null);
    for (const tag of tags) {
      const cur = totals.get(tag) ?? { weight: 0, occurrences: 0 };
      cur.weight += 2;
      cur.occurrences += 1;
      totals.set(tag, cur);
    }
  }

  return [...totals.entries()]
    .map(([tag, v]) => ({ tag, weight: v.weight, occurrences: v.occurrences }))
    .sort((a, b) => b.weight - a.weight);
}

function extractTags(payload: Record<string, unknown> | null | undefined): string[] {
  if (!payload) return [];
  const raw = payload["tags"] ?? payload["category"] ?? payload["categories"];
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase().trim());
}
