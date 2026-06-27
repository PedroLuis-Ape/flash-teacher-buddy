import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const OFFICIAL_PROJECT_ID = "xrnfhhoxmmstagmelvyi";

type RuntimeConfig = {
  projectId: string;
  url: string;
  publishableKey: string;
};

const runtimeWindow = typeof window !== "undefined"
  ? (window as typeof window & { __APE_SUPABASE_CONFIG__?: RuntimeConfig })
  : undefined;
const runtime = runtimeWindow?.__APE_SUPABASE_CONFIG__;
const configuredProjectId = runtime?.projectId ?? import.meta.env.VITE_SUPABASE_PROJECT_ID;
const configuredUrl = runtime?.url ?? import.meta.env.VITE_SUPABASE_URL;
const configuredPublicValue = runtime?.publishableKey ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const testMode = import.meta.env.MODE === "test";
const supabaseUrl = configuredUrl || (testMode ? "https://example.supabase.co" : "");
const publicValue = configuredPublicValue || (testMode ? "test-value" : "");

if (configuredProjectId && configuredProjectId !== OFFICIAL_PROJECT_ID) {
  throw new Error("Supabase project mismatch.");
}

if (runtime) {
  const projectFromHost = new URL(runtime.url).hostname.split(".")[0];
  if (runtime.projectId !== OFFICIAL_PROJECT_ID || projectFromHost !== OFFICIAL_PROJECT_ID) {
    throw new Error("Invalid runtime configuration.");
  }
}

if (!supabaseUrl || !publicValue) {
  throw new Error("Supabase runtime configuration is unavailable.");
}

export const supabase = createClient<Database>(supabaseUrl, publicValue, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
