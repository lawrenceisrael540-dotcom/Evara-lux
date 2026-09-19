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

## Not yet decided

- NEXA Points / NEXA Coins mechanics and ledger schema (directive exists,
  no implementation).
- Virtual card system and Aura-driven personalization wiring between
  `packages/design` and real customer data.
- Withdrawal flow, fraud/risk scoring specifics, notification system.
- How `packages/backend` gets deployed (Vercel serverless vs. long-running
  process) — affects how the orchestrator loop is triggered (cron, queue,
  webhook).
