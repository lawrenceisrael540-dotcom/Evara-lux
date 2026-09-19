# EVARA-LUX Design System

**Same DNA, different personality.** Every page and catalog in EVARA-LUX gets its own atmosphere, composition and motion, while foundations that protect usability, accessibility and performance stay locked.

This repository turns the creative directive into something a team can build, test and enforce.

## What is here

| Path | Purpose |
| --- | --- |
| `docs/01-design-dna.md` | Locked tokens, experiential tokens, and how they relate |
| `docs/02-aura-system.md` | Name, meaning, emotion, aura, and the nine starter auras |
| `docs/03-experience-engines.md` | Page and catalog engines, configuration schema, validation |
| `docs/04-motion-language.md` | Four tempos and the reduced-motion contract |
| `docs/05-quality-gates.md` | Budgets, accessibility floor, and the final design test |
| `docs/06-roadmap.md` | Phases, acceptance criteria, definition of done |
| `docs/ORIGINAL_DIRECTIVE.md` | The unchanged creative directive |
| `src/design/` | TypeScript source: tokens, auras, motion, engine |
| `examples/pages.config.ts` | Example page registry |
| `site/index.html` | Interactive design site. Open it in a browser |
| `scripts/` | `verify.mjs` (tests) and `sync-site.mjs` (keeps the site in step with code) |

## Quick start

```bash
npm install
npm run check      # builds, runs 20 checks, syncs the design site
open site/index.html
```

`npm run verify` fails if any aura drops below the contrast floors, if reduced motion stops being a short fade, or if two pages become near-duplicates.

## How it works

```
Page or catalog config
  -> aura (palette + experiential tokens)
  -> motion preset (tempo)
  -> composition (separate for compact and expanded screens)
  -> composeExperience() -> CSS variables + motion + layout for the renderer
```

```ts
import { composeExperience } from "./src/design";
import { pages } from "./examples/pages.config";

const exp = composeExperience(pages[0]);
exp.cssVars;                  // apply to the page root element
exp.motion(prefersReduced);   // durations, easing, allowed properties
exp.composition("compact");   // "vertical-story"
```

## Principles

1. Locked foundations, variable personality. See `docs/01-design-dna.md`.
2. Pages are data. Adding a page means adding a config, not a template.
3. Accessibility and performance are checked by code, not by intention.
4. Do not sacrifice usability for novelty, performance for effects, or accessibility for aesthetics.

## Status

Values in `presets.ts`, `tokens.ts` and the budgets are **starting proposals**. Tune them against the real product in phase 1 and 2 of the roadmap.
