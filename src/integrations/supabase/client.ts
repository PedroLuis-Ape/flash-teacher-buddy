import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createDedupingFetch } from "./dedupFetch";
import { readPlatformRuntime } from "./platformRuntime";
import { installSessionReadCoalescing } from "./sessionCoalescing";

const { url, publicValue } = readPlatformRuntime();

const client = createClient<Database>(url, publicValue, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: createDedupingFetch(fetch),
  },
});

export const supabase = installSessionReadCoalescing(client);
