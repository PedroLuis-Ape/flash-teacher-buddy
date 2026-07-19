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

export const MANAGED_SUPABASE_PROJECT_ID = "xrnfhhoxmmstagmelvyi";
export const PRODUCTION_DATA_PROJECT_ID = "ymahldldyxvwjeruaxpr";
export const PRODUCTION_DATA_URL = `https://${PRODUCTION_DATA_PROJECT_ID}.supabase.co`;
export const PRODUCTION_DATA_PUBLIC_VALUE = [
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWhsZGxkeXh2d2plcnVheHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDE2ODMsImV4cCI6MjA3NDkxNzY4M30",
  ".idlg2X65uZWkJcbLOrtr_0ug8G13nP93LUGAfSNv43w",
].join("");

export const PRODUCTION_DATA_RUNTIME: PlatformRuntime = Object.freeze({
  projectId: PRODUCTION_DATA_PROJECT_ID,
  url: PRODUCTION_DATA_URL,
  publicValue: PRODUCTION_DATA_PUBLIC_VALUE,
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

function assertProductionDataRuntime(runtime: PlatformRuntime): PlatformRuntime {
  const parsed = new URL(runtime.url);
  const projectId = runtime.projectId ?? parsed.hostname.split(".")[0];
  if (
    projectId !== PRODUCTION_DATA_PROJECT_ID
    || parsed.protocol !== "https:"
    || parsed.hostname !== `${PRODUCTION_DATA_PROJECT_ID}.supabase.co`
  ) {
    throw new Error("A configuração não aponta para o backend de dados em produção.");
  }
  return { ...runtime, projectId };
}

function readIfProductionData(input: PlatformRuntimeInput | undefined): PlatformRuntime | null {
  const runtime = completeRuntime(input);
  if (!runtime) return null;
  try {
    return assertProductionDataRuntime(runtime);
  } catch (error) {
    console.warn("[PlatformRuntime] Configuração externa ignorada; mantendo o backend com os dados existentes.", error);
    return null;
  }
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

  return readIfProductionData(installed)
    ?? readIfProductionData(input)
    ?? { ...PRODUCTION_DATA_RUNTIME };
}

export function installPlatformRuntime(runtime: PlatformRuntime): void {
  const production = assertProductionDataRuntime(runtime);
  if (typeof window !== "undefined") window.__APE_PLATFORM_RUNTIME__ = production;
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
