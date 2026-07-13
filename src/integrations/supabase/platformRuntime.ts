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

export const OFFICIAL_SUPABASE_PROJECT_ID = "xrnfhhoxmmstagmelvyi";
export const OFFICIAL_SUPABASE_URL = `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`;

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

export function assertOfficialPlatformRuntime(runtime: PlatformRuntime): PlatformRuntime {
  const parsed = new URL(runtime.url);
  const projectId = runtime.projectId ?? parsed.hostname.split(".")[0];
  if (
    projectId !== OFFICIAL_SUPABASE_PROJECT_ID
    || parsed.protocol !== "https:"
    || parsed.hostname !== `${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`
  ) {
    throw new Error("A configuração não aponta para o projeto Supabase oficial do App Piteco.");
  }
  return { ...runtime, projectId, url: parsed.origin };
}

function readIfOfficial(input: PlatformRuntimeInput | undefined): PlatformRuntime | null {
  const runtime = completeRuntime(input);
  if (!runtime) return null;
  try {
    return assertOfficialPlatformRuntime(runtime);
  } catch (error) {
    console.warn("[PlatformRuntime] Configuração externa de outro projeto ignorada.", error);
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

  const runtime = readIfOfficial(installed) ?? readIfOfficial(input);
  if (!runtime) {
    throw new Error("A configuração pública do Supabase oficial ainda não foi instalada.");
  }
  return runtime;
}

export function installPlatformRuntime(runtime: PlatformRuntime): void {
  const official = assertOfficialPlatformRuntime(runtime);
  if (typeof window !== "undefined") window.__APE_PLATFORM_RUNTIME__ = official;
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
