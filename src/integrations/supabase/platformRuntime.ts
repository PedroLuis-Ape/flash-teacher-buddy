export type PlatformRuntime = {
  projectId?: string;
  url: string;
  publicValue: string;
};

export function readPlatformRuntime(): PlatformRuntime {
  const testMode = import.meta.env.MODE === "test";
  const url = import.meta.env.VITE_SUPABASE_URL || (testMode ? "https://example.supabase.co" : "");
  const publicValue = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (testMode ? "test-public-value" : "");
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  if (!url || !publicValue) {
    throw new Error("Lovable Cloud configuration is unavailable.");
  }

  return { projectId, url, publicValue };
}
