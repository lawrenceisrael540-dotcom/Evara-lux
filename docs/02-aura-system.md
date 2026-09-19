# 02. Aura system

An aura is the felt identity of a page or catalog. It is derived, not picked.

## The derivation chain

```
NAME -> MEANING -> EMOTION -> AURA -> visual language -> motion language -> layout -> interaction
```

For a new page, write these five lines before opening a design tool:

1. **Name**: what the page is called to users.
2. **Meaning**: what the name evokes, in one sentence.
3. **Emotion**: the feeling on arrival, in two or three words.
4. **Environment**: "If this page were a room, what would entering it feel like?"
5. **Aura**: choose an existing aura or propose a new one and validate it.

## Inputs to an aura

Page name, purpose, user intent, data type, emotional state, business function, and an optional video or motion theme.

## Starter auras

| Codename | Domain | Feel | Tempo |
| --- | --- | --- | --- |
| Obsidian Command | Executive | commanding, strategic, restrained | slow |
| Midnight Ledger | Finance | precise, controlled, trustworthy | measured |
| Velvet Product | Product | desirable, cinematic, tactile | slow |
| Signal Marketing | Marketing | energetic, kinetic, creative | kinetic |
| Orbit Customer | Customer | human, warm, personal | measured |
| Flowline Operations | Operations | mechanical, continuous, systematic | brisk |
| Neural Atlas | Analytics | clear, layered, revealing | measured |
| Sentinel Security | Security | defensive, minimal, alert | brisk |
| Chorus Agents | Agents | alive, specialised, dynamic | brisk |

Full palettes and token values are in `src/design/presets.ts`. Open `site/index.html` to preview them.

## Video-aware auras

A video is the source of an aura, not decoration added afterwards.

```
VIDEO -> pace and colour -> AURA -> layout -> motion -> typography -> product presentation -> interaction
```

`deriveAuraFromVideo(base, sample)` maps measurements taken at build time:

- **Pace** (cuts per minute) sets the motion tempo: under 4 slow, under 10 measured, under 24 brisk, otherwise kinetic.
- **Brightness** sets `auraIntensity`, so bright footage gets a lighter atmosphere layer.
- **Dominant colours**: the first one that clears the accent contrast floor becomes the accent. If none does, the base accent stays.

The result is validated, so footage can never produce an inaccessible page. Every video also needs a poster image, and autoplay is muted and disabled for reduced motion and data-saver users.

## Catalogs

Catalogs use the same chain. A catalog can change atmosphere, typography treatment, motion, layout, navigation model, product presentation, transitions, density, imagery, lighting and story structure. Changing only the title, image and accent colour is not enough and fails review.

## AI presence

Intelligence appears in context, never as a chat widget pasted onto every page. An insight is a config object (`InsightSlot`) and must:

- state one plain-language finding, for example "Revenue rose 12%, but contribution margin fell"
- cite its data source
- appear at most once per view, inline, in the margin, or as an annotation
- be dismissible and never block the task
