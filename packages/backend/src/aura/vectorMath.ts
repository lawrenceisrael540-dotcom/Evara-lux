import type { AuraVector, Archetype, AuraPalette, ExperienceTokens } from "./types.js";
import { ZERO_VECTOR } from "./types.js";

const DIMS: (keyof AuraVector)[] = ["warmth", "drama", "density", "energy", "heritage"];

export function addScaled(base: AuraVector, delta: AuraVector, scale: number): AuraVector {
  const out = { ...base };
  for (const d of DIMS) out[d] = out[d] + delta[d] * scale;
  return out;
}

export function clamp01Vector(v: AuraVector): AuraVector {
  const out = { ...v };
  for (const d of DIMS) out[d] = Math.max(0, Math.min(1, out[d]));
  return out;
}

export function distance(a: AuraVector, b: AuraVector): number {
  let sum = 0;
  for (const d of DIMS) sum += (a[d] - b[d]) ** 2;
  return Math.sqrt(sum);
}

/** Nearest two archetypes to a computed vector, closest first. */
export function nearestTwo(vector: AuraVector, archetypes: Archetype[]): [Archetype, Archetype] {
  const ranked = [...archetypes].sort((a, b) => distance(vector, a.vector) - distance(vector, b.vector));
  if (ranked.length < 2) throw new Error("Need at least 2 archetypes to blend");
  return [ranked[0]!, ranked[1]!];
}

/**
 * Blend weight toward the secondary archetype, based on how much closer the
 * customer's vector is to the primary than the secondary. Inverse-distance
 * weighting, capped so the primary never fully disappears — a card should
 * lean into an identity, not average it into mush.
 */
export function computeBlendWeight(vector: AuraVector, primary: Archetype, secondary: Archetype): number {
  const dPrimary = distance(vector, primary.vector);
  const dSecondary = distance(vector, secondary.vector);
  if (dPrimary + dSecondary === 0) return 0;
  const raw = dPrimary / (dPrimary + dSecondary); // 0 = exactly at primary
  return Math.min(raw, 0.45); // cap: secondary contributes at most 45%
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHexColor(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(lerp(pa.r, pb.r, t));
  const g = Math.round(lerp(pa.g, pb.g, t));
  const bl = Math.round(lerp(pa.b, pb.b, t));
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Resolves the final rendered palette/tokens as: neutral-default -> blend
 * toward (primary, then secondary) scaled by confidence. Low confidence
 * (a new customer, or one search) stays close to a calm neutral rather than
 * committing hard to a personality on thin evidence — this is the
 * "one random search doesn't permanently change someone's identity" rule
 * from the directive, expressed structurally rather than as a special case.
 */
export function resolveVisuals(
  primary: Archetype,
  secondary: Archetype,
  blendWeight: number,
  confidence: number,
  neutral: Archetype
): { palette: AuraPalette; tokens: ExperienceTokens } {
  // Step 1: blend primary + secondary.
  const blendedPalette: AuraPalette = {
    surface: lerpHexColor(primary.palette.surface, secondary.palette.surface, blendWeight),
    surfaceRaised: lerpHexColor(primary.palette.surfaceRaised, secondary.palette.surfaceRaised, blendWeight),
    ink: lerpHexColor(primary.palette.ink, secondary.palette.ink, blendWeight),
    inkMuted: lerpHexColor(primary.palette.inkMuted, secondary.palette.inkMuted, blendWeight),
    accent: lerpHexColor(primary.palette.accent, secondary.palette.accent, blendWeight),
    signal: lerpHexColor(primary.palette.signal, secondary.palette.signal, blendWeight),
  };

  // Step 2: pull the blend toward neutral by (1 - confidence).
  const finalPalette: AuraPalette = {
    surface: lerpHexColor(neutral.palette.surface, blendedPalette.surface, confidence),
    surfaceRaised: lerpHexColor(neutral.palette.surfaceRaised, blendedPalette.surfaceRaised, confidence),
    ink: lerpHexColor(neutral.palette.ink, blendedPalette.ink, confidence),
    inkMuted: lerpHexColor(neutral.palette.inkMuted, blendedPalette.inkMuted, confidence),
    accent: lerpHexColor(neutral.palette.accent, blendedPalette.accent, confidence),
    signal: lerpHexColor(neutral.palette.signal, blendedPalette.signal, confidence),
  };

  const blendedIntensity = lerp(primary.tokens.auraIntensity, secondary.tokens.auraIntensity, blendWeight);
  const blendedDrama = lerp(primary.tokens.typographicDrama, secondary.tokens.typographicDrama, blendWeight);
  const blendedVideo = lerp(primary.tokens.videoIntensity, secondary.tokens.videoIntensity, blendWeight);

  const finalTokens: ExperienceTokens = {
    ...primary.tokens,
    auraIntensity: lerp(neutral.tokens.auraIntensity, blendedIntensity, confidence),
    typographicDrama: lerp(neutral.tokens.typographicDrama, blendedDrama, confidence),
    videoIntensity: lerp(neutral.tokens.videoIntensity, blendedVideo, confidence),
    // Discrete tokens (motionTempo, lighting, imageTreatment, density levels)
    // snap to the primary archetype once confidence clears a modest bar,
    // otherwise stay at the neutral default — these don't blend gracefully
    // as continuous values the way color/intensity do.
    motionTempo: confidence > 0.35 ? primary.tokens.motionTempo : neutral.tokens.motionTempo,
    lighting: confidence > 0.35 ? primary.tokens.lighting : neutral.tokens.lighting,
    imageTreatment: confidence > 0.35 ? primary.tokens.imageTreatment : neutral.tokens.imageTreatment,
    visualDensity: confidence > 0.35 ? primary.tokens.visualDensity : neutral.tokens.visualDensity,
    depthLevel: confidence > 0.35 ? primary.tokens.depthLevel : neutral.tokens.depthLevel,
    interactionDensity: confidence > 0.35 ? primary.tokens.interactionDensity : neutral.tokens.interactionDensity,
  };

  return { palette: finalPalette, tokens: finalTokens };
}

export { ZERO_VECTOR };
