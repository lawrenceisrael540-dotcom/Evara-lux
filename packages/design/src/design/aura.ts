import { a11y } from "./tokens.js";

export type Lighting = "ambient" | "directional" | "spot" | "diffuse";
export type ImageTreatment = "natural" | "graded" | "monochrome" | "duotone";
export type MotionTempo = "slow" | "measured" | "brisk" | "kinetic";
export type Level5 = 1 | 2 | 3 | 4 | 5;
export type Depth = 0 | 1 | 2 | 3 | 4;

export interface AuraPalette {
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  accent: string;
  signal: string;
}

/** The experiential tokens from the directive, made concrete. */
export interface ExperienceTokens {
  auraIntensity: number; // 0..1, strength of atmosphere layers
  motionTempo: MotionTempo;
  visualDensity: Level5;
  depthLevel: Depth;
  lighting: Lighting;
  typographicDrama: number; // 0..1, scale contrast and weight range
  imageTreatment: ImageTreatment;
  videoIntensity: number; // 0..1
  interactionDensity: Level5;
}

export interface Aura {
  id: string;
  codename: string;
  domain: string;
  meaning: string;
  feel: readonly string[];
  palette: AuraPalette;
  tokens: ExperienceTokens;
}

/* ---------- contrast maths (WCAG 2.x) ---------- */

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- validation ---------- */

const inUnit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;

/** Returns a list of problems. An empty list means the aura is shippable. */
export function validateAura(aura: Aura): string[] {
  const p = aura.palette;
  const t = aura.tokens;
  const problems: string[] = [];
  const need = (label: string, fg: string, bg: string, min: number) => {
    const r = contrastRatio(fg, bg);
    if (r < min) problems.push(`${aura.id}: ${label} contrast ${r.toFixed(2)} < ${min}`);
  };
  need("ink on surface", p.ink, p.surface, a11y.contrast.bodyText);
  need("ink on surfaceRaised", p.ink, p.surfaceRaised, a11y.contrast.bodyText);
  need("inkMuted on surface", p.inkMuted, p.surface, a11y.contrast.secondaryText);
  need("accent on surface", p.accent, p.surface, a11y.contrast.uiAccent);
  need("signal on surface", p.signal, p.surface, a11y.contrast.uiAccent);
  need("focus ring (accent) on surface", p.accent, p.surface, a11y.contrast.focusRing);
  if (p.surface.toLowerCase() === p.surfaceRaised.toLowerCase()) {
    problems.push(`${aura.id}: surfaceRaised must differ from surface (depth needs a step)`);
  }
  for (const k of ["auraIntensity", "typographicDrama", "videoIntensity"] as const) {
    if (!inUnit(t[k])) problems.push(`${aura.id}: ${k} must be within 0..1`);
  }
  if (aura.feel.length < 3) problems.push(`${aura.id}: describe the feel in at least 3 words`);
  return problems;
}

/* ---------- output ---------- */

/** CSS custom properties for an aura. Apply to a page root element. */
export function auraToCssVars(aura: Aura): Record<string, string> {
  const { palette: p, tokens: t } = aura;
  return {
    "--aura-surface": p.surface,
    "--aura-surface-raised": p.surfaceRaised,
    "--aura-ink": p.ink,
    "--aura-ink-muted": p.inkMuted,
    "--aura-accent": p.accent,
    "--aura-signal": p.signal,
    "--aura-intensity": String(t.auraIntensity),
    "--aura-density": String(t.visualDensity),
    "--aura-depth": String(t.depthLevel),
    "--aura-drama": String(t.typographicDrama),
    "--aura-video": String(t.videoIntensity),
    "--aura-interaction": String(t.interactionDensity),
  };
}

/* ---------- video -> aura ---------- */

export interface VideoSample {
  /** Average scene cuts per minute, measured at build time. */
  cutsPerMinute: number;
  /** Dominant colours from sampled frames, most common first. */
  dominantColors: readonly string[];
  /** Mean luminance 0..1 across sampled frames. */
  meanLuminance: number;
}

export function tempoFromCuts(cutsPerMinute: number): MotionTempo {
  if (cutsPerMinute < 4) return "slow";
  if (cutsPerMinute < 10) return "measured";
  if (cutsPerMinute < 24) return "brisk";
  return "kinetic";
}

/**
 * Derives an aura from a video: pace sets tempo, brightness sets intensity,
 * and the first dominant colour that passes contrast becomes the accent.
 * The result is validated, so a video can never break accessibility.
 */
export function deriveAuraFromVideo(base: Aura, sample: VideoSample): Aura {
  const accent =
    sample.dominantColors.find(
      (c) => contrastRatio(c, base.palette.surface) >= a11y.contrast.uiAccent,
    ) ?? base.palette.accent;
  const derived: Aura = {
    ...base,
    palette: { ...base.palette, accent },
    tokens: {
      ...base.tokens,
      motionTempo: tempoFromCuts(sample.cutsPerMinute),
      auraIntensity: Math.min(1, Math.max(0.2, 1 - sample.meanLuminance * 0.5)),
    },
  };
  const problems = validateAura(derived);
  if (problems.length) throw new Error(`Derived aura invalid: ${problems.join("; ")}`);
  return derived;
}
