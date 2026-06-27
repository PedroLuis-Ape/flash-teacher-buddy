export type PlatformRuntime = {
  projectId?: string;
  url: string;
  publicValue: string;
};

type PlatformRuntimeInput = {
  projectId?: string;
  url?: string;
  publicValue?: string;
};

/**
 * Public browser configuration used by the production Lovable Cloud project.
 *
 * These values are not administrative secrets: the URL and anon key are
 * necessarily shipped to every browser that uses the application. RLS and
 * server-side authorization remain the actual security boundary.
 *
 * Lovable normally injects the VITE_* values during its build. The installed
 * PWA, however, must still be able to start when a published bundle is built
 * without those variables. In that case we fall back to the same production
 * backend that already contains the application's real data.
 */
const PRODUCTION_RUNTIME: PlatformRuntime = Object.freeze({
  projectId: "ymahldldyxvwjeruaxpr",
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  publicValue:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWhsZGxkeXh2d2plcnVheHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDE2ODMsImV4cCI6MjA3NDkxNzY4M30.idlg2X65uZWkJcbLOrtr_0ug8G13nP93LUGAfSNv43w",
});

function normalize(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result || undefined;
}

export function resolvePlatformRuntime(
  input: PlatformRuntimeInput,
  testMode = false,
): PlatformRuntime {
  const url = normalize(input.url);
  const publicValue = normalize(input.publicValue);
  const projectId = normalize(input.projectId);

  // A complete Lovable-injected pair always wins.
  if (url && publicValue) {
    return { projectId, url, publicValue };
  }

  // Never let tests contact production.
  if (testMode) {
    return {
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    };
  }

  // A partial or absent build configuration is unusable. Do not mix values
  // from different projects; replace the whole set atomically.
  console.warn(
    "[PlatformRuntime] Lovable build configuration was not injected; using the bundled production browser configuration.",
  );
  return { ...PRODUCTION_RUNTIME };
}

export function readPlatformRuntime(): PlatformRuntime {
  return resolvePlatformRuntime(
    {
      projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
      url: import.meta.env.VITE_SUPABASE_URL,
      publicValue: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    import.meta.env.MODE === "test",
  );
}
