# DECISION_LOG.md

Append-only. Each entry: date, decision, why, alternatives rejected.

## 2026-09-19 — Auth provider: Supabase Auth (not Convex)

The live schema's `evara_customers.external_auth_id` column carried a
comment describing a Convex-Auth bridge. No Convex app was confirmed to
exist. Decision: treat it as unused scaffolding, remove the Convex
assumption, standardize on Supabase Auth. Rationale: one fewer system to
run/pay for, and Supabase already holds every other piece of state.
`external_auth_id` was kept as free text (not a strict FK to `auth.users`)
so a future SSO/federated provider doesn't require another identity
migration.

## 2026-09-19 — Base currency: USD, customer-selectable display currency

Schema defaulted to NGN everywhere. Decision: ledger/base currency is USD;
customers pick their own `preferred_currency` (defaults to USD);
conversion goes through `evara_currency_rates`, a single-source-of-truth
table rather than hardcoded rates in application code. Only USD has a rate
row so far — adding a second currency at checkout requires inserting its
rate first.

## 2026-09-19 — Repo structure: npm workspaces monorepo

Three artifacts existed independently: the live Supabase schema, an
in-progress backend/orchestrator scaffold (this session), and an
already-built design/Aura system (uploaded separately). Merged into one
repo: `packages/backend` (orchestrator, event bus, agents, config, DB
client) and `packages/design` (tokens, aura engine, motion, presets, the
verify/sync scripts, demo site). Root `docs/` holds both source directives
plus `DATABASE.md` and this log. Rationale: one repo, one history, one
place decisions get recorded — the empty GitHub repo was meant to be the
source of truth and wasn't being used as one.

## 2026-09-19 — NEXA Points ledger: already built, reused as-is

Reconnaissance found `evara_points_transactions` / `evara_loyalty_accounts`
/ `evara_points_earn|spend|reverse|post|submit` already fully implemented
— idempotent, advisory-locked, immutable, `SECURITY DEFINER`. Decision:
don't rebuild it. Mirror its exact pattern for Coins instead of inventing
a new one, for consistency and because it's a proven design.

## 2026-09-19 — NEXA Coins: separate ledger, status/access purpose

Built `evara_coin_accounts` / `evara_coins_transactions` /
`evara_coins_earn|spend|reverse|post|submit`, structurally identical to
the Points ledger. Purpose deliberately different: Points = purchase-driven
loyalty/tier progress; Coins = earned from engagement/achievement/NEXA
Moments, spent on card customization, exclusive access, personalization
upgrades. See `docs/NEXA_LEDGER.md`.

**Security bug caught and fixed same session:** the first migration left
all new `SECURITY DEFINER` functions executable by `anon`/`authenticated`
via PostgREST RPC (Postgres grants `EXECUTE` to `PUBLIC` by default on
function creation — revoking from `anon`/`authenticated` directly wasn't
sufficient while the `PUBLIC` grant remained). Caught via
`mcp__Supabase__get_advisors` (security) before any client code could
have used it; fixed by revoking from `PUBLIC` and granting only to
`service_role`, matching the existing Points functions' actual grants
(verified against `information_schema.role_routine_grants`).

## 2026-09-19 — Weekly NEXA Moment: deterministic, not chance-based

`evara_nexa_moments` schedules one random instant per customer per ISO
week (uniqueness enforced by DB constraint, not application logic) inside
a configured window; the reward itself is fixed/configured, only the
timing is randomized. Chosen specifically to avoid gambling mechanics per
the directive's explicit instruction.

## 2026-09-19 — Virtual card: identity/history table holds no balances

`evara_cards` holds status + version pointer only. `evara_card_versions`
is immutable append-only history (each row a full visual snapshot).
`evara_card_events` records every evolution candidate, including ones that
didn't produce a new version — chosen so the "don't evolve on weak
evidence" gate (see next entry) is auditable, not silent.

## 2026-09-19 — Aura personalization: continuous vector blend, not category lookup

Explicitly rejected an `if interest = X then theme = Y` design per the
user's direction. Built instead: 5-dimension continuous aesthetic vector
(`warmth/drama/density/energy/heritage`) fed by recency+frequency-decayed
behavioral signals, resolved to a blend of the nearest 2 of 6 seeded
archetypes, scaled by a confidence score that pulls low-confidence
customers toward a neutral default rather than committing to a
personality on thin evidence. Age range and gender were directive inputs
but were deliberately left unconnected — no legitimate non-stereotyping
use for them surfaced. Full writeup: `docs/AURA_PIPELINE.md`.

## Not yet decided / not yet built

- The actual scheduler/worker wiring: nothing yet calls
  `evara_nexa_moment_schedule`/`award`, `evolveCardForLifecycleEvent`, or
  `evaluatePreferenceDrift` — the primitives exist, the triggers don't.
- Rendering: no UI consumes the Aura engine's resolved palette/tokens yet.
- Coins-funded card customization catalog — what a Coin purchase actually
  unlocks isn't defined yet.
- Withdrawal flow, fraud/risk scoring specifics, notification system.
- How `packages/backend` gets deployed (Vercel serverless vs. long-running
  process) — affects how the orchestrator loop is triggered (cron, queue,
  webhook).
- Two pre-existing advisor warnings not touched this session (not ours to
  silently fix): `evara_products_public`/`evara_product_variants_public`
  are `SECURITY DEFINER` views, and leaked-password protection is off in
  Auth settings.
