import { getSupabaseAdmin } from "../db/supabase.js";

/**
 * NEXA Coins are a STATUS/ACCESS currency, not a discount currency — see
 * docs/NEXA_LEDGER.md. This module only calls the SECURITY DEFINER RPCs
 * already deployed in Postgres (evara_coins_*); it holds no business logic
 * of its own beyond generating good idempotency keys, because the ledger's
 * correctness guarantees (immutability, balance integrity, idempotent
 * replay) live in the database functions, not here.
 */

export type CoinsEarnKind = "earn" | "achievement" | "nexa_moment";

export interface LedgerResult {
  transaction_id: string;
  status: "posted" | "pending" | "failed";
  replayed: boolean;
  coins_balance: number;
  lifetime_coins: number;
}

function idempotencyKey(parts: (string | number)[]): string {
  return parts.map(String).join(":");
}

export async function earnCoins(params: {
  customerId: string;
  kind: CoinsEarnKind;
  amount: number;
  reference?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Caller-supplied idempotency source, e.g. an order id or event id. Required — silently
   * generating a random key here would defeat the whole point of idempotency. */
  idempotencySource: string;
}): Promise<LedgerResult> {
  const supabase = getSupabaseAdmin();
  const key = idempotencyKey(["coins", params.kind, params.customerId, params.idempotencySource]);
  const { data, error } = await supabase.rpc("evara_coins_earn", {
    p_key: key,
    p_customer: params.customerId,
    p_kind: params.kind,
    p_amount: params.amount,
    p_reference: params.reference ?? null,
    p_reason: params.reason ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) throw new Error(`earnCoins failed: ${error.message}`);
  return data as LedgerResult;
}

export async function spendCoins(params: {
  customerId: string;
  amount: number;
  reference?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  idempotencySource: string;
}): Promise<LedgerResult> {
  const supabase = getSupabaseAdmin();
  const key = idempotencyKey(["coins", "spend", params.customerId, params.idempotencySource]);
  const { data, error } = await supabase.rpc("evara_coins_spend", {
    p_key: key,
    p_customer: params.customerId,
    p_amount: params.amount,
    p_reference: params.reference ?? null,
    p_reason: params.reason ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) throw new Error(`spendCoins failed: ${error.message}`);
  return data as LedgerResult;
}

export async function reverseCoinsTransaction(params: {
  originalTransactionId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  idempotencySource: string;
}): Promise<LedgerResult> {
  const supabase = getSupabaseAdmin();
  const key = idempotencyKey(["coins", "reverse", params.originalTransactionId, params.idempotencySource]);
  const { data, error } = await supabase.rpc("evara_coins_reverse", {
    p_key: key,
    p_original_tx: params.originalTransactionId,
    p_reason: params.reason ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) throw new Error(`reverseCoinsTransaction failed: ${error.message}`);
  return data as LedgerResult;
}
