# 06. Roadmap

## Gate

Design implementation (phases 2 to 4) starts only after the current security remediation has been verified. Phase 1 is read-only and can run in parallel.

## Phase 1: Audit (read-only)

Inspect the repository. Produce `docs/audit.md` containing:

- a map of every page, catalog and experience with route, purpose and current composition
- the places where the interface repeats itself (card grids, identical heroes, repeated tables)
- the existing component library and what would block variation
- the video assets that exist, if any

**Done when:** every route is listed and each has a proposed aura and pair of compositions.

## Phase 2: Foundation

- Tokens, `base.css`, auras, motion, engine wired into the app
- Page config registry replacing hard-coded page structures where practical
- CI: `npm run verify`, Lighthouse CI, axe scan, reduced-motion test

**Done when:** CI is green and one blank page renders in any aura by changing a single config value.

## Phase 3: Pilot

Redesign two contrasting pages end to end, for example the executive page and one catalog. Record composition candidates considered and why the winner was chosen.

**Done when:** both pages pass every gate in `05-quality-gates.md`, look clearly different, and are unmistakably EVARA-LUX in a side-by-side review.

## Phase 4: Rollout

Move remaining pages and catalogs one world at a time. After each, run the final design test and a visual regression across all auras.

**Done when:** no two pages in the same section share composition and aura, every catalog has its own world, and budgets hold on the full app.

## Definition of done for any page

- Has a config, an aura with a stated name and meaning, and separate compact and expanded compositions
- Passes automated and manual gates
- Keyboard, screen reader and reduced-motion verified
- Its choice of composition is documented
