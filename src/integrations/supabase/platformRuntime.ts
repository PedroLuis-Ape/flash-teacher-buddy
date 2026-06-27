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

const PRODUCTION_PROJECT_ID = "ymahldldyxvwjeruaxpr";
const PRODUCTION_RUNTIME: PlatformRuntime = Object.freeze({
  projectId: PRODUCTION_PROJECT_ID,
  url: `https://${PRODUCTION_PROJECT_ID}.supabase.co`,
  publicValue:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWhsZGxkeXh2d2plcnVheHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDE2ODMsImV4cCI6MjA3NDkxNzY4M30.idlg2X65uZWkJcbLOrtr_0ug8G13nP93LUGAfSNv43w",
});

function normalize(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result || undefined;
}

function isOfficialProductionRuntime(input: PlatformRuntimeInput): boolean {
  const projectId = normalize(input.projectId);
  const url = normalize(input.url);
  return projectId === PRODUCTION_PROJECT_ID
    || url === PRODUCTION_RUNTIME.url
    || Boolean(url?.includes(PRODUCTION_PROJECT_ID));
}

export function resolvePlatformRuntime(
  input: PlatformRuntimeInput,
  testMode = false,
  allowDevelopmentOverride = false,
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

  // Local development may intentionally point to another project.
  if (allowDevelopmentOverride && url && publicValue) {
    return { projectId, url, publicValue };
  }

  // Production is locked to the Lovable Cloud project that contains the real
  // App Piteco accounts, folders, lists and flashcards. A stale Lovable/Supabase
  // integration may inject another project at build time; accepting that value
  // makes the app look empty even though the user's data still exists.
  if (url && publicValue && isOfficialProductionRuntime(input)) {
    return {
      projectId: PRODUCTION_PROJECT_ID,
      url: PRODUCTION_RUNTIME.url,
      publicValue,
    };
  }

  if (url && publicValue) {
    console.error(
      `[PlatformRuntime] Ignoring unexpected production backend ${projectId ?? url}; using ${PRODUCTION_PROJECT_ID}.`,
    );
  } else {
    console.warn(
      "[PlatformRuntime] Build configuration was not injected; using the bundled production browser configuration.",
    );
  }

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
    import.meta.env.DEV,
  );
}
