-- EVARA-LUX: add covering indexes for foreign keys identified by Supabase advisors.
-- Reviewed against the live schema on 2026-10-19.
-- Safe to re-run; this migration does not change data, policies, grants, or balances.
-- Apply during a controlled migration window and verify advisor results afterward.

create index if not exists idx_evara_card_events_customer_id
  on public.evara_card_events (customer_id);

create index if not exists idx_evara_cart_items_product_id
  on public.evara_cart_items (product_id);

create index if not exists idx_evara_cart_items_variant_id
  on public.evara_cart_items (variant_id);

create index if not exists idx_evara_categories_parent_id
  on public.evara_categories (parent_id);

create index if not exists idx_evara_coins_transactions_related_transaction_id
  on public.evara_coins_transactions (related_transaction_id);

create index if not exists idx_evara_customer_aura_state_archetype_primary_id
  on public.evara_customer_aura_state (archetype_primary_id);

create index if not exists idx_evara_customer_aura_state_archetype_secondary_id
  on public.evara_customer_aura_state (archetype_secondary_id);

create index if not exists idx_evara_loyalty_accounts_tier_assigned_by
  on public.evara_loyalty_accounts (tier_assigned_by);

create index if not exists idx_evara_nexa_moments_coins_transaction_id
  on public.evara_nexa_moments (coins_transaction_id);

create index if not exists idx_evara_order_items_order_id
  on public.evara_order_items (order_id);

create index if not exists idx_evara_order_items_product_id
  on public.evara_order_items (product_id);

create index if not exists idx_evara_order_items_variant_id
  on public.evara_order_items (variant_id);

create index if not exists idx_evara_order_status_history_admin_user_id
  on public.evara_order_status_history (admin_user_id);

create index if not exists idx_evara_order_status_history_order_id
  on public.evara_order_status_history (order_id);

create index if not exists idx_evara_orders_wallet_hold_id
  on public.evara_orders (wallet_hold_id);

create index if not exists idx_evara_orders_wallet_transaction_id
  on public.evara_orders (wallet_transaction_id);

create index if not exists idx_evara_product_variants_product_id
  on public.evara_product_variants (product_id);

create index if not exists idx_evara_wishlist_items_product_id
  on public.evara_wishlist_items (product_id);
