import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** PostgREST errors are plain objects; throwing them breaks Next.js error UI. */
export function assertNoSupabaseError(
  error: { message?: string; details?: string | null; hint?: string | null; code?: string } | null,
  context: string,
): asserts error is null {
  if (!error) return;
  const parts = [error.message, error.details, error.hint].filter((v): v is string => Boolean(v));
  const tail = parts.length > 0 ? parts.join(" — ") : error.code ?? "unknown error";
  throw new Error(`${context}: ${tail}`, { cause: error });
}

/**
 * Repricing uses the Supabase URL plus a key, in this order:
 * 1. `SUPABASE_SERVICE_ROLE_KEY` (server-only; bypasses RLS) when set and non-empty
 * 2. Otherwise `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 *
 * If you see **Invalid API key**, the key does not match `NEXT_PUBLIC_SUPABASE_URL`
 * (wrong project, typo, or stale paste). Fix the key in Supabase → Project Settings → API,
 * or remove `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` so the anon key is used instead.
 *
 * Lazy singleton — avoids calling createClient at module load time (which breaks
 * `next build` when env vars are not available during route analysis).
 */
export function getRepricingSupabase(): SupabaseClient {
  if (client) {
    return client;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const supabaseKey = serviceKey || anonKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env for repricing. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY (server) or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local / Vercel.",
    );
  }
  client = createClient(supabaseUrl, supabaseKey);
  return client;
}
