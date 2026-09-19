# AURA_PIPELINE.md — Signal-to-Visual Pipeline

## Why not `if category = X then aura = Y`

The directive is explicit that this is the failure mode to avoid. The
pipeline instead works in a small continuous vector space so that no
single input maps directly to a single visual output:

```
raw events + wishlist  →  recency+frequency decayed tag weights
                         →  weighted sum through per-tag vectors  →  customer vector (5 dims)
                         →  confidence (saturates with total signal mass)
                         →  nearest 2 of 6 archetypes, by vector distance
                         →  blend weight (how much of the 2nd archetype leaks in)
                         →  resolve: blend(primary, secondary) pulled toward
                            a neutral default by (1 − confidence)
                         →  final palette + tokens
```

No step is a lookup table from identity/demographic category to color.
The five vector dimensions (`warmth`, `drama`, `density`, `energy`,
`heritage`) are aesthetic, not identity — see `evara_signal_aura_vectors`
for what actually feeds them (style/category tags like `minimalist`,
`streetwear`, `vintage`, `luxury`, not age/gender/etc). Age range and
gender, per the directive, are **not** wired into this pipeline at all
right now — there was no legitimate signal to plug them into that wasn't
"map demographic to look," which is exactly the pattern being avoided.
If a real product need for them shows up later, it needs its own
justification, not a slot in this vector.

## Recency + frequency, not a single event

`packages/backend/src/aura/signals.ts`: every event's contribution decays
with a 21-day half-life. A `PRODUCT_VIEWED` from today counts fully; the
same event from 63 days ago counts for ~1/8. `ORDER_PAID` starts at 6x the
base weight of a view, `PRODUCT_ADDED_TO_CART` at 3x — a purchase is much
stronger evidence of taste than a glance. Wishlist items are treated as
standing (non-decaying) interest at a fixed weight, since "still saved"
already implies it's not a one-off.

## Confidence, and why low confidence matters structurally

`confidence = 1 − e^(−0.15 × totalWeightedSignal)`. This isn't decorative
— `resolveVisuals()` in `vectorMath.ts` uses it to pull the *entire*
resolved palette/tokens toward a calm neutral archetype (`lunar-quiet`)
when confidence is low, and only commits to discrete choices (motion
tempo, lighting, image treatment) once confidence clears 0.35. A brand
new customer, or one with only a couple of weak signals, gets a
restrained default card — not a hard-committed identity built on noise.
This is the concrete mechanism behind "one random search doesn't
permanently change someone's identity."

## Where this doesn't connect yet

- `packages/design`'s `Aura`/`ExperienceTokens` types (for EVARA's
  internal admin surfaces) are structurally identical to this pipeline's
  output shape, but the two are intentionally separate concept spaces —
  internal-page auras (`obsidian-command`, `midnight-ledger`, …) are
  chosen by page domain; customer archetypes (`obsidian-noir`,
  `aurelia-warm`, …) are computed from behavior. Sharing the *type shape*
  was deliberate (see `evara_aura_archetypes.tokens` — same shape as
  `packages/design`'s `ExperienceTokens`); sharing actual instances was
  not, since they answer different questions.
- No caller triggers `computeAuraState` or `evaluatePreferenceDrift` yet
  — see the "Not yet built" sections in `CARD.md` and `NEXA_LEDGER.md`.
