# NEXA_LEDGER.md — Points, Coins, and the Weekly Moment

## Two ledgers, never mixed

**NEXA Points** (`evara_points_transactions` / `evara_loyalty_accounts`) —
already existed before this pass. Earned primarily through purchases,
drives loyalty tier (`evara_loyalty_tier_recompute`).

**NEXA Coins** (`evara_coins_transactions` / `evara_coin_accounts`) — new.
A separate, immutable ledger with the same integrity guarantees (advisory
lock on idempotency key, `SECURITY DEFINER` functions, immutability
trigger, status transitions `pending -> posted|failed` only).

**Purpose split, so Coins aren't just "Points but different name":**
Points = ordinary transactional loyalty (you bought something, you earn
points, points move you up a tier). Coins = a status/access currency,
earned from *engagement and achievement* moments rather than routine
spend (`kind IN ('earn','achievement','nexa_moment')`), and spent on
things money and points don't buy: card customization unlocks, early or
exclusive catalog access, and personalization upgrades. Neither ledger's
balance is ever combined with the other or with the wallet's money balance
in a single displayed number — see directive section 23.

## Function surface (mirrors the existing Points pattern exactly)

`evara_coins_earn`, `evara_coins_spend`, `evara_coins_reverse` are the
public entry points. All go through `evara_coins_submit`, which:
1. Takes an advisory lock on the idempotency key (prevents concurrent
   double-submission).
2. Checks for an existing transaction with that key — if found, returns
   the same result (`replayed: true`) instead of erroring or double-paying.
3. Inserts a `pending` transaction, immediately posts it
   (`evara_coins_post`), which locks the account row, applies the balance
   delta by `kind`, and marks the transaction `posted`.

All of this runs as `SECURITY DEFINER`, but **EXECUTE is revoked from
`anon`/`authenticated`/`PUBLIC`** — only `service_role` (i.e. the
backend, never a browser) can call these. This was actually a live bug
introduced during this pass — Postgres grants `EXECUTE` to `PUBLIC` by
default on function creation, so the first migration accidentally left
these callable by anyone with the anon key. Caught and fixed via
`mcp__Supabase__get_advisors` before this doc was written; see
`DECISION_LOG.md`.

`packages/backend/src/ledger/coins.ts` is the TypeScript client — thin
wrapper generating idempotency keys and calling the RPCs, no business
logic of its own.

## Weekly NEXA Moment

`evara_nexa_moments` — one row per `(customer_id, iso_week)`, enforced by
a unique constraint, so double-award is structurally impossible even under
concurrent workers. `evara_nexa_moment_schedule` picks a uniform-random
instant inside a configured window and stores it; `evara_nexa_moment_award`
is safe to call repeatedly (e.g. by a polling worker checking for due
moments) — it no-ops on anything not `scheduled` and due.

This is a **deterministic promotional reward**, not gambling: eligibility,
window, and reward amount are all configured (not chance-of-winning), only
the exact instant within the window is randomized, matching the
directive's explicit instruction to avoid gambling mechanics.

Not yet built: the actual scheduler/worker that calls `evara_nexa_moment_schedule`
for all active customers at the start of each week and polls
`evara_nexa_moment_award` for due ones. The SQL primitives exist; the
cron/orchestrator wiring doesn't yet.
