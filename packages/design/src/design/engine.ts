import { auraById } from "./presets.js";
import { auraToCssVars, type Aura, type VideoSample, deriveAuraFromVideo } from "./aura.js";
import { motionFor, type ResolvedMotion } from "./motion.js";
import type { Breakpoint } from "./tokens.js";

export type Composition =
  | "immersive-hero"
  | "editorial-asymmetric"
  | "cinematic-timeline"
  | "command-center"
  | "spatial-data"
  | "interactive-canvas"
  | "split-screen"
  | "product-environment"
  | "constellation"
  | "minimal-luxury"
  | "vertical-story"
  | "layered-depth";

export type StoryBeat =
  | "opening" | "introduction" | "discovery" | "exploration"
  | "interaction" | "decision" | "action" | "aftermath";

export type NavigationModel = "spine" | "spatial" | "rail" | "command-palette" | "scroll-chapters";

/** An AI insight surfaces in context. It never blocks and always cites its data. */
export interface InsightSlot {
  id: string;
  /** Plain-language statement, e.g. "Revenue rose 12%, but margin fell." */
  statement: string;
  /** Where the number or claim came from. Required, so insights stay auditable. */
  dataSource: string;
  surface: "inline" | "margin" | "annotation";
  dismissible: true;
}

export interface VideoConfig {
  src: string;
  poster: string;
  /** Build-time measurements. Drives the aura via deriveAuraFromVideo. */
  sample?: VideoSample;
}

/** Shared by pages and catalogs: the Name -> Meaning -> Emotion chain. */
export interface Identity {
  id: string;
  name: string;
  meaning: string;
  emotion: string;
  auraId: string;
}

export interface PageConfig extends Identity {
  route: string;
  section: string;
  purpose: string;
  userIntent: string;
  dataType: string;
  /** A distinct composition per breakpoint class; compact is never a re-stack of desktop. */
  composition: { compact: Composition; expanded: Composition };
  story: readonly StoryBeat[];
  navigation: NavigationModel;
  insights?: readonly InsightSlot[];
  video?: VideoConfig;
}

export interface CatalogConfig extends Identity {
  slug: string;
  composition: { compact: Composition; expanded: Composition };
  navigation: NavigationModel;
  video?: VideoConfig;
}

export interface ResolvedExperience {
  aura: Aura;
  cssVars: Record<string, string>;
  motion: (prefersReducedMotion: boolean) => ResolvedMotion;
  composition: (bp: Breakpoint) => Composition;
}

/** Turns a config into everything a renderer needs. Pure and side-effect free. */
export function composeExperience(
  cfg: PageConfig | CatalogConfig,
  resolveAura: (id: string) => Aura | undefined = auraById,
): ResolvedExperience {
  const base = resolveAura(cfg.auraId);
  if (!base) throw new Error(`Unknown aura "${cfg.auraId}" for "${cfg.id}"`);
  const aura = cfg.video?.sample ? deriveAuraFromVideo(base, cfg.video.sample) : base;
  return {
    aura,
    cssVars: auraToCssVars(aura),
    motion: (reduced) => motionFor(aura.tokens.motionTempo, reduced),
    composition: (bp) => (bp === "compact" || bp === "medium" ? cfg.composition.compact : cfg.composition.expanded),
  };
}

/* ---------- registry validation ---------- */

/**
 * The distinctness rules that keep "every page is different" true and
 * "every page is EVARA-LUX" enforceable. Run in CI.
 */
export function validateRegistry(
  pages: readonly PageConfig[],
  resolveAura: (id: string) => Aura | undefined = auraById,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const routes = new Set<string>();
  const seen = new Map<string, string>();

  for (const p of pages) {
    if (ids.has(p.id)) errors.push(`duplicate page id: ${p.id}`);
    if (routes.has(p.route)) errors.push(`duplicate route: ${p.route}`);
    ids.add(p.id);
    routes.add(p.route);

    if (!resolveAura(p.auraId)) errors.push(`${p.id}: unknown aura "${p.auraId}"`);
    if (p.composition.compact === p.composition.expanded) {
      errors.push(`${p.id}: compact composition must differ from expanded (no simple re-stacking)`);
    }
    if (p.story.length === 0) errors.push(`${p.id}: define at least one story beat`);
    if ((p.insights?.length ?? 0) > 1) errors.push(`${p.id}: at most one AI insight per view`);
    if (p.video && !p.video.poster) errors.push(`${p.id}: video requires a poster image`);

    const key = `${p.section}|${p.composition.expanded}|${p.auraId}`;
    const clash = seen.get(key);
    if (clash) errors.push(`${p.id} and ${clash} share section, composition and aura; make one distinct`);
    else seen.set(key, p.id);
  }
  return errors;
}
