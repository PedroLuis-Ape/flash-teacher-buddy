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

declare global {
  interface Window {
    __APE_PLATFORM_RUNTIME__?: PlatformRuntime;
  }
}

const FALLBACK_RUNTIME: PlatformRuntime = Object.freeze({
  projectId: "ymahldldyxvwjeruaxpr",
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  publicValue: [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWhsZGxkeXh2d2plcnVheHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDE2ODMsImV4cCI6MjA3NDkxNzY4M30",
    ".idlg2X65uZWkJcbLOrtr_0ug8G13nP93LUGAfSNv43w",
  ].join(""),
});

function normalize(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result || undefined;
}

function completeRuntime(input: PlatformRuntimeInput | undefined): PlatformRuntime | null {
  const url = normalize(input?.url);
  const publicValue = normalize(input?.publicValue);
  const projectId = normalize(input?.projectId);
  return url && publicValue ? { projectId, url, publicValue } : null;
}

export function resolvePlatformRuntime(
  input: PlatformRuntimeInput,
  testMode = false,
  installed?: PlatformRuntimeInput,
): PlatformRuntime {
  if (testMode) {
    return {
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    };
  }

  const runtime = completeRuntime(installed) ?? completeRuntime(input);
  if (runtime) return runtime;

  console.warn(
    "[PlatformRuntime] Complete configuration was not injected; using the previous bundled fallback.",
  );
  return { ...FALLBACK_RUNTIME };
}

export function installPlatformRuntime(runtime: PlatformRuntime): void {
  if (typeof window !== "undefined") window.__APE_PLATFORM_RUNTIME__ = runtime;
}

export function readPlatformRuntime(): PlatformRuntime {
  return resolvePlatformRuntime(
    {
      projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
      url: import.meta.env.VITE_SUPABASE_URL,
      publicValue: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    import.meta.env.MODE === "test",
    typeof window !== "undefined" ? window.__APE_PLATFORM_RUNTIME__ : undefined,
  );
}
