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

const FALLBACK_RUNTIME: PlatformRuntime = Object.freeze({
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

  if (testMode) {
    return {
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    };
  }

  // Lovable's complete injected configuration is the source of truth because
  // it carries the current project URL and current public key as one coherent
  // set. This also avoids using a stale legacy key after rotations.
  if (url && publicValue) {
    return { projectId, url, publicValue };
  }

  // Installed/PWA builds created without VITE variables still need a coherent
  // public browser fallback. Never combine a partial injected set with it.
  console.warn(
    "[PlatformRuntime] Complete Lovable configuration was not injected; using the bundled browser fallback.",
  );
  return { ...FALLBACK_RUNTIME };
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
