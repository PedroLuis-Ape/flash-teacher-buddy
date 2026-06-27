import { createClient } from "@supabase/supabase-js";
import { readPlatformRuntime } from "./platformRuntime";

const { url, publicValue } = readPlatformRuntime();

/**
 * Auth client isolated from the application's primary login.
 * It is used only after the visitor explicitly enables anonymous history sync.
 *
 * It must use the same resolved runtime as the primary client. Reading Vite
 * variables directly here made installed builds crash with
 * `supabaseUrl is required` whenever Lovable did not inject the variables.
 */
export const guestSyncClient = createClient(url, publicValue, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "ape-guest-history-sync-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
