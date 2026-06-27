import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getPlatformBackend } from "./platformBackend";

const { url, publicValue } = getPlatformBackend();

export const supabase = createClient<Database>(url, publicValue, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
