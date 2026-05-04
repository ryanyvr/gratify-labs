import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Lazy singleton — avoids calling createClient at module load time (which breaks
 * `next build` when env vars are not available during route analysis).
 */
export function getRepricingSupabase(): SupabaseClient {
  if (client) {
    return client;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (set in Vercel project env).",
    );
  }
  client = createClient(supabaseUrl, supabaseKey);
  return client;
}
