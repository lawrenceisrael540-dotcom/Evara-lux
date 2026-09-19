# EVARA-LUX

AI-native commerce operating system. Monorepo.

## Structure

```
packages/
  backend/    orchestrator, event bus, agents, config, Supabase client (TS)
  design/     design tokens, Aura engine, motion language, demo site
docs/         both source directives, live DB schema snapshot, decision log
```

## Where things stand (2026-09-19)

- **Database is live**: Supabase project `cbsctyinhbtqsgdycwhd`, 38 tables
  already deployed — customers, wallets, loyalty, orders, and a full
  agent/orchestrator/decision schema. See `docs/DATABASE.md`.
- **Backend** (`packages/backend`) is a scaffold, not a running service
  yet: env validation, a cached `evara_config` reader, a canonical event
  type registry, a service-role Supabase client. No API server, no agents
  implemented, no deploy target chosen yet.
- **Design system** (`packages/design`) is further along: locked base
  tokens, an Aura engine (palette/motion/density personality per page),
  presets, a verify/sync pipeline, and a working demo site. See
  `docs/01-design-dna.md` through `docs/06-roadmap.md`.
- **NEXA Points**: already existed (`evara_points_*`), untouched.
- **NEXA Coins**: new, separate ledger, same battle-tested pattern as
  Points. See `docs/NEXA_LEDGER.md`.
- **Weekly NEXA Moment**: DB primitives built (dedup-safe scheduling +
  award). Not yet wired to a scheduler.
- **Virtual card**: identity/version/event tables built
  (`packages/backend/src/cards/cardEngine.ts`). Not yet wired to real
  lifecycle triggers or a UI.
- **Aura personalization engine**: behavior → weighted signals → 5D vector
  → confidence → archetype blend → resolved palette/tokens
  (`packages/backend/src/aura/`). Deliberately not a category-lookup
  table — see `docs/AURA_PIPELINE.md`.
- **Not built yet**: withdrawal flow, notifications, the scheduler/trigger
  wiring for the above, rendering. See `docs/DECISION_LOG.md` → "Not yet
  decided / not yet built" for the full open list.

## Setup

```bash
npm install
cp packages/backend/.env.example packages/backend/.env
# fill in SUPABASE_SERVICE_ROLE_KEY — never commit this file
```

## Read this first

`docs/DECISION_LOG.md` — every non-obvious architectural call and why it
was made, most recent first-ish (append-only, so scan from the top).
