# 03. Experience engines

The Page Experience Engine and Catalog Experience Engine share one idea: **pages are data**. A configuration declares identity, and the engine composes the experience. Adding a page never means copying a template.

```
PAGE_CONFIG / CATALOG_CONFIG
  -> resolve aura -> derive from video (optional)
  -> motion preset for the aura's tempo
  -> composition per breakpoint class
  -> composeExperience()  ->  { aura, cssVars, motion(), composition() }
```

## Configuration

Defined in `src/design/engine.ts`.

| Field | Meaning |
| --- | --- |
| `id`, `route`, `section` | Identity and placement |
| `name`, `meaning`, `emotion` | The Name -> Meaning -> Emotion chain |
| `auraId` | Which aura the page uses |
| `purpose`, `userIntent`, `dataType` | Inputs to the aura decision |
| `composition.compact` and `.expanded` | A separate layout per screen class |
| `story` | Beats from opening to aftermath the page uses |
| `navigation` | spine, spatial, rail, command-palette, scroll-chapters |
| `insights` | Zero or one AI insight |
| `video` | Source, poster, and optional build-time sample |

## Compositions

`immersive-hero`, `editorial-asymmetric`, `cinematic-timeline`, `command-center`, `spatial-data`, `interactive-canvas`, `split-screen`, `product-environment`, `constellation`, `minimal-luxury`, `vertical-story`, `layered-depth`.

Add more as the product needs them. A composition is a layout contract implemented once and reused by any page that selects it.

## Validation rules

`validateRegistry(pages)` runs in CI and fails on:

- duplicate ids or routes
- an unknown aura
- **compact composition equal to expanded** (this is what stops mobile becoming a re-stack)
- an empty story
- more than one AI insight on a page
- a video without a poster
- two pages in the same section sharing both composition and aura (this is what keeps "every page is different" enforceable)

## Choosing a composition

For every major page, sketch at least three candidates from different families (minimal, editorial, spatial, cinematic, data-driven) and record why the winner fits the aura. Do not reuse a composition just because it worked elsewhere.

## Data visualisation

Prefer forms that fit the data: network maps, flowing timelines, constellation graphs, radial systems, activity rivers, decision trees, customer journey maps, operational flow fields. The test is meaning, not novelty. If a plain bar chart says it best, use it.

## Naming

Give each experience a design name that describes its language, not its page, for example "Midnight Ledger" rather than "Finance page".
