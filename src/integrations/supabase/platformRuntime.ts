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

const LOVABLE_CLOUD_FALLBACK: PlatformRuntime = Object.freeze({
  projectId: "ymahldldyxvwjeruaxpr",
  url: "https://ymahldldyxvwjeruaxpr.supabase.co",
  publicValue:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWhsZGxkeXh2d2plcnVheHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDE2ODMsImV4cCI6MjA3NDkxNzY4M30.idlg2X65uZWkJcbLOrtr_0ug8G13nP93LUGAfSNv43w",
});

function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function projectIdFromUrl(url: string): string | undefined {
  try {
    const [projectId, ...rest] = new URL(url).hostname.split(".");
    return rest.join(".") === "supabase.co" ? projectId : undefined;
  } catch {
    return undefined;
  }
}

export function resolvePlatformRuntime(
  input: PlatformRuntimeInput,
  testMode = false,
): PlatformRuntime {
  const url = clean(input.url);
  const publicValue = clean(input.publicValue);
  const projectId = clean(input.projectId);

  // Never combine a value injected for one backend with the fallback value of
  // another backend. A complete pair wins; a partial pair is ignored safely.
  if (url && publicValue) {
    return {
      projectId: projectId ?? projectIdFromUrl(url),
      url,
      publicValue,
    };
  }

  if (testMode) {
    return {
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    };
  }

  return { ...LOVABLE_CLOUD_FALLBACK };
}

export function readPlatformRuntime(): PlatformRuntime {
  const testMode = import.meta.env.MODE === "test";
  const input: PlatformRuntimeInput = {
    url: import.meta.env.VITE_SUPABASE_URL,
    publicValue: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  };

  if (!testMode && (!clean(input.url) || !clean(input.publicValue))) {
    console.warn(
      "[PlatformRuntime] Build variables unavailable; using the canonical Lovable Cloud public configuration.",
    );
  }

  return resolvePlatformRuntime(input, testMode);
}
