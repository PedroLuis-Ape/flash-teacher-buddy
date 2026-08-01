import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { readPlatformRuntime } from "./platformRuntime";
import { createSessionFreeDedupingFetch } from "./dedupFetch";

const { url, publicValue } = readPlatformRuntime();

/**
 * Session-free client for `/portal/*` reads.
 *
 * A public route must keep the same RLS role before and after a visitor logs in.
 * Reusing the primary client would attach the private session and could make the
 * same public URL return a different result for authenticated visitors.
 */
export const publicSupabase = createClient<Database>(url, publicValue, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: createSessionFreeDedupingFetch(fetch),
  },
});
