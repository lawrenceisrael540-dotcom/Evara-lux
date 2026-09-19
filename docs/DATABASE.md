# DATABASE.md — Current Live Schema

**Project:** `Evara-lux` (`cbsctyinhbtqsgdycwhd`, eu-west-1, Postgres 17)

This documents what is *actually deployed* in Supabase right now, as of
2026-09-19. Treat this file as a snapshot, not a source of truth — the
schema itself, via `list_tables`, is the source of truth. Update this file
whenever a migration changes the shape of the schema meaningfully.

## Domains present

- **Orchestrator / agents** — `evara_events`, `evara_agent_definitions`,
  `evara_agent_runs`, `evara_ai_decisions`, `evara_decision_actions`,
  `evara_execution_steps`, `evara_recovery_attempts`, `evara_learning_signals`
- **Customer 360** — `evara_customers`, `evara_customer_profiles`,
  `evara_customer_consents`, `evara_customer_sessions`, `evara_customer_events`
- **Admin / RBAC** — `evara_admin_roles`, `evara_admin_permissions`,
  `evara_admin_role_permissions`, `evara_admin_users`, `evara_admin_audit_logs`
- **Wallet / financial ledger** — `evara_wallets`, `evara_wallet_transactions`,
  `evara_wallet_entries`, `evara_wallet_holds`
- **Loyalty** — `evara_loyalty_tiers`, `evara_loyalty_accounts`,
  `evara_loyalty_points_transactions`
- **Catalog / commerce** — `evara_products`, `evara_product_variants`,
  `evara_product_categories`, `evara_carts`, `evara_cart_items`,
  `evara_wishlist_items`, `evara_orders`, `evara_order_items`,
  `evara_order_status_history`
- **Security** — `evara_security_allowlist`, `evara_security_findings`
- **Config / currency** — `evara_config` (per-environment key/value store),
  `evara_currency_rates` (added 2026-09-19 — see below)

## Identity architecture (decided 2026-09-19)

`evara_customers.external_auth_id` is a flexible text bridge to whatever
auth provider is in front of the app. It previously carried a Convex-Auth
comment (`convex:<users._id>`) from an earlier, now-abandoned plan. That
was replaced: **Supabase Auth is the identity provider.**
`external_auth_id` now defaults to holding `auth.users.id` as text — kept
as text rather than a strict foreign key so a future federated/SSO
provider doesn't require another identity migration.

## Currency architecture (decided 2026-09-19)

- Base/ledger currency: **USD** (was NGN — changed via migration).
- `evara_customer_profiles.preferred_currency` — the currency a given
  customer sees prices and their wallet in. Defaults to `USD`, free to
  change per customer.
- `evara_currency_rates(currency_code, units_per_usd, source, updated_at)` —
  single source of truth for converting the USD ledger into a customer's
  preferred display currency. Only contains `USD → 1` so far; other
  currencies need rates inserted before they're usable at checkout.
- Money, NEXA Points, and NEXA Coins (once built) must stay in **separate
  ledgers** — see `evara_wallet_*` for the pattern to extend, and
  `06-roadmap.md` / this file's changelog for what's not built yet.

## Not yet built (tracked, not assumed)

- NEXA Points ledger, NEXA Coins ledger, virtual card system, withdrawal
  flow, notification system, personalization/experience-graph tables.
  These are directive content (see `docs/00-living-ecosystem-directive.md`)
  — no tables exist for them yet. Do not assume they're modeled.
- No Supabase Edge Functions are deployed. All compute is expected to run
  in `packages/backend` for now.
