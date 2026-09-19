import { getSupabaseAdmin } from "../db/supabase.js";
import { computeTagWeights } from "./signals.js";
import { addScaled, clamp01Vector, nearestTwo, computeBlendWeight, resolveVisuals } from "./vectorMath.js";
import { ZERO_VECTOR } from "./types.js";
import type { Archetype, AuraVector, CustomerAuraState } from "./types.js";

/** The calm default a low-confidence customer's card resolves toward. */
const NEUTRAL_ARCHETYPE_ID = "lunar-quiet";

/**
 * Confidence saturates with total weighted signal mass — a handful of
 * views/wishlist adds gets you to moderate confidence, but it takes
 * sustained, varied engagement to reach high confidence. sigmoid-ish curve,
 * not linear, so early signals matter less individually (protects against
 * one strong purchase looking like certainty) while a genuine pattern
 * still reaches high confidence within a reasonable number of events.
 */
function computeConfidence(totalWeight: number): number {
  const k = 0.15; // tuning: how fast confidence climbs with signal mass
  return 1 - Math.exp(-k * totalWeight);
}

async function loadArchetypes(): Promise<Archetype[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("evara_aura_archetypes").select("id, codename, palette, tokens, vector");
  if (error) throw new Error(`loadArchetypes failed: ${error.message}`);
  if (!data || data.length < 2) throw new Error("Need at least 2 aura archetypes seeded");
  return data as unknown as Archetype[];
}

async function loadSignalVectors(): Promise<Map<string, AuraVector>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("evara_signal_aura_vectors").select("tag, vector");
  if (error) throw new Error(`loadSignalVectors failed: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.tag as string, row.vector as unknown as AuraVector]));
}

/**
 * Full pipeline: behavior -> weighted tags -> vector -> confidence ->
 * nearest archetypes -> blend -> resolved visuals -> persisted snapshot.
 * Call this after significant events (purchase, N new views, wishlist
 * change) — not on every single page view; see cardEngine.ts for the
 * significance gate that decides when to call this.
 */
export async function computeAuraState(customerId: string): Promise<CustomerAuraState> {
  const [tagWeights, archetypes, signalVectors] = await Promise.all([
    computeTagWeights(customerId),
    loadArchetypes(),
    loadSignalVectors(),
  ]);

  let vector: AuraVector = { ...ZERO_VECTOR };
  let totalWeight = 0;
  for (const { tag, weight } of tagWeights) {
    const contribution = signalVectors.get(tag);
    if (!contribution) continue; // unmapped tag: contributes nothing, doesn't error
    vector = addScaled(vector, contribution, weight);
    totalWeight += weight;
  }
  // Normalize by total weight so the vector reflects the *shape* of
  // interest, not just raw volume, then re-clamp into the archetype space.
  if (totalWeight > 0) {
    for (const k of Object.keys(vector) as (keyof AuraVector)[]) {
      vector[k] = vector[k] / totalWeight;
    }
  }
  vector = clamp01Vector({
    warmth: vector.warmth + 0.5,
    drama: vector.drama + 0.5,
    density: vector.density + 0.5,
    energy: vector.energy + 0.5,
    heritage: vector.heritage + 0.5,
  }); // recenter from the [-1,1]-ish contribution space into [0,1] archetype space

  const confidence = computeConfidence(totalWeight);
  const [primary, secondary] = nearestTwo(vector, archetypes);
  const blendWeight = computeBlendWeight(vector, primary, secondary);
  const neutral = archetypes.find((a) => a.id === NEUTRAL_ARCHETYPE_ID) ?? primary;
  const { palette, tokens } = resolveVisuals(primary, secondary, blendWeight, confidence, neutral);

  const state: CustomerAuraState = {
    customerId,
    archetypePrimaryId: primary.id,
    archetypeSecondaryId: secondary.id,
    blendWeight,
    confidence,
    vector,
    topSignals: tagWeights.slice(0, 8).map((t) => ({ tag: t.tag, weight: t.weight })),
    resolvedPalette: palette,
    resolvedTokens: tokens,
  };

  await persistAuraState(state);
  return state;
}

async function persistAuraState(state: CustomerAuraState): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("evara_customer_aura_state").upsert(
    {
      customer_id: state.customerId,
      archetype_primary_id: state.archetypePrimaryId,
      archetype_secondary_id: state.archetypeSecondaryId,
      blend_weight: state.blendWeight,
      confidence: state.confidence,
      vector: state.vector,
      top_signals: state.topSignals,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" }
  );
  if (error) throw new Error(`persistAuraState failed: ${error.message}`);
}

export async function getPreviousAuraState(customerId: string): Promise<CustomerAuraState | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("evara_customer_aura_state")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`getPreviousAuraState failed: ${error.message}`);
  if (!data) return null;
  return {
    customerId: data.customer_id,
    archetypePrimaryId: data.archetype_primary_id,
    archetypeSecondaryId: data.archetype_secondary_id,
    blendWeight: Number(data.blend_weight),
    confidence: Number(data.confidence),
    vector: data.vector,
    topSignals: data.top_signals,
    resolvedPalette: {} as CustomerAuraState["resolvedPalette"], // not stored raw; recompute if needed for display
    resolvedTokens: {} as CustomerAuraState["resolvedTokens"],
  };
}
