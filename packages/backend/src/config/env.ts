import { z } from "zod";

/**
 * Fails fast at boot if required secrets are missing, rather than
 * discovering a missing SUPABASE_SERVICE_ROLE_KEY three requests in.
 */
const envSchema = z.object({
  EVARA_ENVIRONMENT: z.enum(["dev", "staging", "prod"]).default("dev"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Deliberately verbose: a misconfigured backend should be loud at boot,
    // not silently degrade into confusing 500s later.
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("EVARA failed to boot: invalid environment configuration");
  }
  cached = parsed.data;
  return cached;
}
