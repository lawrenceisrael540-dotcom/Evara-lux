# EVARA-LUX live baseline audit — 2026-10-19

## Scope

Read-only inspection of the connected Supabase project `cbsctyinhbtqsgdycwhd` and GitHub repository `lawrenceisrael540-dotcom/Evara-lux`. No production schema, customer records, secrets, grants, or Auth settings were changed during this audit.

## Confirmed state

- Supabase reports `ACTIVE_HEALTHY`, PostgreSQL 17, region `eu-west-1`.
- The public schema contains the customer, admin/RBAC, wallet, loyalty, catalog/commerce, currency, NEXA Coins, card, Aura, coupon, and agent-orchestration tables. RLS is enabled on the inspected public tables.
- The repository README identifies `packages/backend` as a scaffold rather than a deployed/running service. The backend has env validation, config reading, event types, and a server-side Supabase client, but no completed API server or deployed agent runtime is documented.
- Supabase Edge Functions list should be checked again before relying on any assumption about deployment; this audit did not deploy functions.

## Security findings and disposition

### 1. Leaked-password protection is disabled — action required

Supabase Auth's security advisor reports leaked-password protection is disabled. Enable it in Supabase Auth settings, then test registration, sign-in, password change, and reset flows. This is an Auth dashboard setting; it is intentionally not changed by this SQL migration.

### 2. Coupon tables have RLS but no policies — currently fail-closed

The advisor reports no policies on `public.evara_coupons` and `public.evara_coupon_redemptions`. The live grants inspection found no table grants for `anon` or `authenticated`, while `service_role` has the required table privileges. This is consistent with backend-only access and does not by itself demonstrate an exposure. Preserve this design unless a documented user-facing access pattern requires carefully scoped policies. Never solve this warning by granting broad access.

### 3. Secrets and public repository

The backend environment example documents `SUPABASE_SERVICE_ROLE_KEY` as server-only. Keep actual `.env` files and service-role keys out of Git, browser bundles, logs, and ChatGPT messages. This audit did not perform a complete historical secret scan.

## Performance findings

The Supabase performance advisor reports 18 foreign-key relationships without covering indexes. A draft migration is included at `supabase/migrations/20261019210000_index_foreign_key_hotpaths.sql`. It adds indexes only and is idempotent. It has **not** been applied to the live database.

After review and controlled application:
1. Re-run Supabase performance advisors and confirm these findings disappear.
2. Run representative query plans for cart, order, wishlist, loyalty, and card-event access patterns.
3. Check index size and write overhead as real traffic grows.

## Release-critical follow-up

- Establish a reproducible CI pipeline for install, typecheck, build, and design verification; confirm those checks pass from a clean checkout.
- Confirm a deployment target and production runtime for `packages/backend`; do not represent the agent/orchestrator as live until it is deployed and health-checked.
- Test RLS and grants for customer-owned records using unauthenticated, authenticated-owner, authenticated-non-owner, and service-role contexts.
- Verify server-side membership authorization; UI visibility alone must never grant a tier entitlement.
- Test wallet, points, coins, coupon redemption, and checkout concurrency/idempotency before enabling customer-facing money flows.
- Update `docs/DATABASE.md` after the schema inventory has been reconciled with the live database.

## Change control

The draft PR containing the foreign-key index migration is a proposal, not a production deployment. Apply database changes through the project's reviewed migration workflow and verify results afterward.
