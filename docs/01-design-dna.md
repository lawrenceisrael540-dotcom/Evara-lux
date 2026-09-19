# 01. Design DNA

The Design DNA is the shared engineering foundation. It answers one question: what must be true on every page so that radical variation never becomes chaos?

## Two layers

**Locked tokens** (`src/design/tokens.ts`, `base.css`). No page, aura or catalog may override these.

| Group | Rule |
| --- | --- |
| Spacing | 4px base grid, named steps 0 to 10 |
| Type scale | Modular, ratio 1.25, 17px base, body measure 64ch |
| Radius | none, sm, md, lg, pill |
| Breakpoints | compact, medium (720), expanded (1080), wide (1600), ultrawide (2200) |
| Accessibility | 44px touch targets, contrast floors, 2px focus ring, reduced-motion contract |
| Performance | Budgets in `docs/05-quality-gates.md` |
| Interaction | Navigation logic and component behaviour stay consistent |

**Experiential tokens** (`aura.ts`). These carry personality and are set per aura.

| Token | Range | Effect |
| --- | --- | --- |
| `auraIntensity` | 0 to 1 | How much atmosphere fills the space |
| `motionTempo` | slow, measured, brisk, kinetic | Timing and easing family |
| `visualDensity` | 1 to 5 | Information per screen |
| `depthLevel` | 0 to 4 | How many spatial layers, used to signal hierarchy |
| `lighting` | ambient, directional, spot, diffuse | Direction and softness of light |
| `typographicDrama` | 0 to 1 | Scale contrast and weight range, never the scale steps |
| `imageTreatment` | natural, graded, monochrome, duotone | Photo and video grade |
| `videoIntensity` | 0 to 1 | How strongly video drives the page |
| `interactionDensity` | 1 to 5 | Amount of interactive surface |

## Colour architecture

Core DNA is a neutral, dark foundation with premium contrast. Each aura swaps six values: `surface`, `surfaceRaised`, `ink`, `inkMuted`, `accent`, `signal`. Nothing else in the palette may vary. Every palette must pass `validateAura`:

- ink on surface and raised surface: at least 7:1
- muted ink: at least 4.5:1
- accent and signal on surface: at least 4.5:1 (the accent is also the focus ring, so it must clear 3:1)

## Depth

Depth communicates hierarchy: nearer means more important or more interactive. `depthLevel` 0 is flat and dense (security). Level 4 is a fully layered environment (product). Do not use floating translucent panels as a default surface.

## Typography

Type is architecture. Choose one or two typefaces per product and keep the scale steps identical across pages. Auras vary drama only: how big the biggest step is used, and how wide the weight range runs. Keep body lines under 80 characters.

## Change control

- Changing a locked token needs a design review and a visual regression run across every aura.
- Adding an aura needs a passing `validateAura`, a name with meaning, and a distinct composition set (see `03-experience-engines.md`).
