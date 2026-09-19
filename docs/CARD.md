# CARD.md — Virtual EVARA Card

## Data model

- `evara_cards` — one per customer. Holds identity/status only
  (`active|frozen|closed`) and `current_version`. **Never** stores a
  balance — money/points/coins are always read live from their own
  ledgers at render time, so the card can't drift out of sync with the
  wallet.
- `evara_card_versions` — immutable history. Each row is a full visual
  snapshot (`aura_snapshot`: archetype ids, blend weight, confidence,
  resolved palette/tokens) plus which lifecycle event produced it.
  Evolving the card means inserting a new version row and bumping
  `evara_cards.current_version` — done atomically in `evara_card_evolve`,
  never a two-step update.
- `evara_card_events` — every candidate evolution moment, whether or not
  it actually produced a new version (`produced_version` is null when it
  didn't). This is what lets `major_preference_shift` be evaluated
  honestly: most drift-evaluation calls will log-only, not evolve.

## Evolution timeline (directive's list, as implemented)

`new_user -> first_discovery -> first_purchase -> loyalty_milestone -> major_preference_shift -> nexa_moment -> new card version`

The **named lifecycle events** (`new_user`, `first_discovery`,
`first_purchase`, `loyalty_milestone`, `nexa_moment`, `manual`) always
produce a new version when called via
`cardEngine.evolveCardForLifecycleEvent()` — they're meaningful on their
own terms, no gate.

`major_preference_shift` is different: it's evaluated by
`cardEngine.evaluatePreferenceDrift()`, which only evolves the card if
**all three** hold:
1. Vector distance from the last persisted aura state ≥ 0.18 (tuned, not
   derived — revisit once real behavior data exists).
2. New confidence ≥ 0.4 (a low-confidence customer's card shouldn't
   flip on weak evidence).
3. At least 14 days since the last drift-driven evolution (prevents
   churn from oscillating behavior).

Everything that doesn't clear the bar is still recorded via
`evara_card_event_log_only` — nothing is silently dropped, it's just not
promoted to a new card version.

## Not yet built

- The actual polling/trigger wiring that calls `evolveCardForLifecycleEvent`
  at the right moments (on `ORDER_PAID`, on loyalty tier change, on NEXA
  Moment award) and calls `evaluatePreferenceDrift` on a schedule. The
  functions exist; nothing calls them yet.
- Rendering: no UI consumes `resolvedPalette`/`resolvedTokens` yet. That's
  where `packages/design`'s token/motion system and this card engine's
  output are meant to meet — not wired together yet.
- Coins-funded card customization (directive section 6/9) — Coins can be
  spent via `evara_coins_spend`, but no catalog of what a Coin purchase
  actually *unlocks* on the card exists yet.
