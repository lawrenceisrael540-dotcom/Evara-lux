import { getSupabaseAdmin } from "../db/supabase.js";
import { getEnv } from "./env.js";

/**
 * evara_config holds one row per (environment, config_key). This loads and
 * caches the rows for the current process's environment, in-memory, with a
 * short TTL — so a human can change decision_confidence_threshold or flip
 * enable_auto_publish in the database and have it take effect within
 * REFRESH_MS without a redeploy, but we're not hitting Postgres on every
 * single decision either.
 */
const REFRESH_MS = 60_000;

type ConfigRow = { config_key: string; config_value: unknown; is_secret: boolean };

let cache: { values: Map<string, unknown>; loadedAt: number } | undefined;

async function loadConfig(): Promise<Map<string, unknown>> {
  const env = getEnv();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("evara_config")
    .select("config_key, config_value, is_secret")
    .eq("environment", env.EVARA_ENVIRONMENT);

  if (error) {
    throw new Error(`Failed to load evara_config for ${env.EVARA_ENVIRONMENT}: ${error.message}`);
  }

  const values = new Map<string, unknown>();
  for (const row of (data ?? []) as ConfigRow[]) {
    values.set(row.config_key, row.config_value);
  }
  return values;
}

async function getConfigMap(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.loadedAt < REFRESH_MS) return cache.values;
  const values = await loadConfig();
  cache = { values, loadedAt: Date.now() };
  return values;
}

export async function getConfigValue<T>(key: string, fallback: T): Promise<T> {
  const values = await getConfigMap();
  return values.has(key) ? (values.get(key) as T) : fallback;
}

/** The knobs the orchestrator actually reads on the hot path. */
export async function getDecisionThresholds() {
  return {
    confidenceThreshold: await getConfigValue<number>("decision_confidence_threshold", 0.8),
    maxRetry: await getConfigValue<number>("max_retry", 3),
    autoPublishEnabled: await getConfigValue<boolean>("enable_auto_publish", false),
    defaultCurrency: await getConfigValue<string>("default_currency", "USD"),
  };
}
