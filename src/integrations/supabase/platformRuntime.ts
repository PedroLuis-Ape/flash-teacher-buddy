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
export const OFFICIAL_SUPABASE_PUBLIC_VALUE = "sb_publishable_w2P1WAWgbZy7_RI_vu2AvA_kuEmvp5O";

export const OFFICIAL_RUNTIME: PlatformRuntime = Object.freeze({
  projectId: OFFICIAL_SUPABASE_PROJECT_ID,
  url: OFFICIAL_SUPABASE_URL,
  publicValue: OFFICIAL_SUPABASE_PUBLIC_VALUE,
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

function assertOfficialRuntime(runtime: PlatformRuntime): PlatformRuntime {
  const parsed = new URL(runtime.url);
  const projectId = runtime.projectId ?? parsed.hostname.split(".")[0];
  if (
    projectId !== OFFICIAL_SUPABASE_PROJECT_ID
    || parsed.protocol !== "https:"
    || parsed.hostname !== `${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`
  ) {
    throw new Error("O aplicativo tentou conectar a um projeto Supabase diferente do projeto oficial.");
  }
  return { ...runtime, projectId };
}

function readIfOfficial(input: PlatformRuntimeInput | undefined): PlatformRuntime | null {
  const runtime = completeRuntime(input);
  if (!runtime) return null;
  try {
    return assertOfficialRuntime(runtime);
  } catch (error) {
    console.warn("[PlatformRuntime] Configuração externa ignorada; usando a configuração oficial.", error);
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

  return readIfOfficial(installed)
    ?? readIfOfficial(input)
    ?? { ...OFFICIAL_RUNTIME };
}

export function installPlatformRuntime(runtime: PlatformRuntime): void {
  const official = assertOfficialRuntime(runtime);
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
