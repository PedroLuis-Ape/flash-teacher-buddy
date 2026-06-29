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

  throw new Error(
    "A configuração oficial do Supabase não foi carregada antes da inicialização do aplicativo.",
  );
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
