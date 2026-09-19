import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env.js";

let client: SupabaseClient | undefined;

/**
 * Service-role client for backend/orchestrator use only.
 * This bypasses RLS — never expose this client or its key to a browser
 * or mobile bundle. Client-side code should use SUPABASE_ANON_KEY instead,
 * which is bound by RLS policies per table.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const env = getEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
