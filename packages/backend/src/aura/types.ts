export interface AuraVector {
  warmth: number;
  drama: number;
  density: number;
  energy: number;
  heritage: number;
}

export const ZERO_VECTOR: AuraVector = { warmth: 0, drama: 0, density: 0, energy: 0, heritage: 0 };

export interface AuraPalette {
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  accent: string;
  signal: string;
}

export interface ExperienceTokens {
  auraIntensity: number;
  motionTempo: "slow" | "measured" | "brisk" | "kinetic";
  visualDensity: 1 | 2 | 3 | 4 | 5;
  depthLevel: 0 | 1 | 2 | 3 | 4;
  lighting: "ambient" | "directional" | "spot" | "diffuse";
  typographicDrama: number;
  imageTreatment: "natural" | "graded" | "monochrome" | "duotone";
  videoIntensity: number;
  interactionDensity: 1 | 2 | 3 | 4 | 5;
}

export interface Archetype {
  id: string;
  codename: string;
  palette: AuraPalette;
  tokens: ExperienceTokens;
  vector: AuraVector;
}

/**
 * The output of the pipeline for one customer. `top_signals` is for internal
 * debugging/tuning only — the "not creepy" rule from the directive means
 * this NEVER gets surfaced to the customer as text ("you searched X").
 * Only `resolvedPalette`/`resolvedTokens` reach the UI.
 */
export interface CustomerAuraState {
  customerId: string;
  archetypePrimaryId: string;
  archetypeSecondaryId: string | null;
  blendWeight: number; // 0..1, weight toward secondary
  confidence: number; // 0..1
  vector: AuraVector;
  topSignals: { tag: string; weight: number }[];
  resolvedPalette: AuraPalette;
  resolvedTokens: ExperienceTokens;
}
