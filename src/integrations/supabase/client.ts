import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  OFFICIAL_SUPABASE_PROJECT_ID,
  readPlatformRuntime as getPlatformBackend,
} from "./platformRuntime";

const { url, publicValue } = getPlatformBackend();

if (!url.includes(OFFICIAL_SUPABASE_PROJECT_ID)) {
  throw new Error("The Supabase client is not connected to the official App Piteco project.");
}

export const supabase = createClient<Database>(url, publicValue, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
