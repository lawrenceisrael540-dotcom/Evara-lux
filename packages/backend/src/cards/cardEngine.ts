import { getSupabaseAdmin } from "../db/supabase.js";
import { computeAuraState, getPreviousAuraState } from "../aura/engine.js";
import type { CustomerAuraState } from "../aura/types.js";

export type CardTriggerEvent =
  | "new_user"
  | "first_discovery"
  | "first_purchase"
  | "loyalty_milestone"
  | "major_preference_shift"
  | "nexa_moment"
  | "manual";

/**
 * Minimum shift in the customer's aura vector, and minimum confidence, for
 * a "major_preference_shift" evolution to fire from ordinary behavior drift.
 * The named lifecycle triggers (new_user, first_purchase, etc.) bypass this
 * gate entirely — they evolve the card regardless of vector distance,
 * because they're meaningful on their own terms.
 */
const MIN_VECTOR_SHIFT_FOR_EVOLUTION = 0.18;
const MIN_CONFIDENCE_FOR_EVOLUTION = 0.4;
const MIN_DAYS_BETWEEN_DRIFT_EVOLUTIONS = 14;

function vectorDistance(a: CustomerAuraState["vector"], b: CustomerAuraState["vector"]): number {
  const dims: (keyof CustomerAuraState["vector"])[] = ["warmth", "drama", "density", "energy", "heritage"];
  let sum = 0;
  for (const d of dims) sum += (a[d] - b[d]) ** 2;
  return Math.sqrt(sum);
}

/**
 * Call this after a named lifecycle event (new_user, first_purchase,
 * loyalty tier change, a NEXA Moment) — these always evolve the card.
 */
export async function evolveCardForLifecycleEvent(
  customerId: string,
  trigger: Exclude<CardTriggerEvent, "major_preference_shift">,
  metadata: Record<string, unknown> = {}
): Promise<{ version: number } | null> {
  const state = await computeAuraState(customerId);
  const snapshot = auraSnapshotForStorage(state);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("evara_card_evolve", {
    p_customer: customerId,
    p_trigger_event: trigger,
    p_aura_snapshot: snapshot,
    p_metadata: metadata,
  });
  if (error) throw new Error(`evolveCardForLifecycleEvent(${trigger}) failed: ${error.message}`);
  return { version: (data as { version: number }).version };
}

/**
 * Call this periodically / after a batch of new behavior (not on every
 * event). Recomputes the aura, compares against the last persisted state,
 * and only evolves the card if the shift clears both the distance and
 * confidence bars and enough time has passed since the last drift-driven
 * evolution — otherwise logs the event as evaluated-but-not-triggering,
 * per the directive's "don't let one search change identity" rule.
 */
export async function evaluatePreferenceDrift(customerId: string): Promise<{ evolved: boolean; version?: number }> {
  const previous = await getPreviousAuraState(customerId);
  const next = await computeAuraState(customerId);
  const supabase = getSupabaseAdmin();

  if (!previous) {
    // First-ever computation for this customer — not a "shift", just an
    // initial state. Caller should use evolveCardForLifecycleEvent("new_user")
    // for the actual first card, this just seeds the comparison baseline.
    return { evolved: false };
  }

  const shift = vectorDistance(previous.vector, next.vector);
  if (shift < MIN_VECTOR_SHIFT_FOR_EVOLUTION || next.confidence < MIN_CONFIDENCE_FOR_EVOLUTION) {
    await logDriftEvaluated(customerId, shift, next.confidence, false);
    return { evolved: false };
  }

  const { data: lastDriftEvent } = await supabase
    .from("evara_card_events")
    .select("created_at")
    .eq("customer_id", customerId)
    .eq("event_type", "major_preference_shift")
    .not("produced_version", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastDriftEvent) {
    const daysSince = (Date.now() - new Date(lastDriftEvent.created_at as string).getTime()) / 86_400_000;
    if (daysSince < MIN_DAYS_BETWEEN_DRIFT_EVOLUTIONS) {
      await logDriftEvaluated(customerId, shift, next.confidence, false);
      return { evolved: false };
    }
  }

  const { data, error } = await supabase.rpc("evara_card_evolve", {
    p_customer: customerId,
    p_trigger_event: "major_preference_shift",
    p_aura_snapshot: auraSnapshotForStorage(next),
    p_metadata: { shift, confidence: next.confidence },
  });
  if (error) throw new Error(`evaluatePreferenceDrift evolve failed: ${error.message}`);
  return { evolved: true, version: (data as { version: number }).version };
}

async function logDriftEvaluated(customerId: string, shift: number, confidence: number, evolved: boolean) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("evara_card_event_log_only", {
    p_customer: customerId,
    p_event_type: "major_preference_shift",
    p_metadata: { shift, confidence, evolved },
  });
  if (error) throw new Error(`logDriftEvaluated failed: ${error.message}`);
}

function auraSnapshotForStorage(state: CustomerAuraState) {
  return {
    archetype_primary_id: state.archetypePrimaryId,
    archetype_secondary_id: state.archetypeSecondaryId,
    blend_weight: state.blendWeight,
    confidence: state.confidence,
    palette: state.resolvedPalette,
    tokens: state.resolvedTokens,
  };
}
