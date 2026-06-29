import type { PlatformRuntime } from "./platformRuntime";

export const OFFICIAL_SUPABASE_PROJECT_ID = "xrnfhhoxmmstagmelvyi";
export const OFFICIAL_RUNTIME_ENDPOINT = `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/app-public-config`;

const STORAGE_KEY = "ape:platform-runtime:v2";

function normalize(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function validateOfficialRuntime(value: unknown): PlatformRuntime {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A configuração pública do App Piteco é inválida.");
  }

  const record = value as Record<string, unknown>;
  const projectId = normalize(record.projectId);
  const url = normalize(record.url);
  const publicValue = normalize(record.publicValue ?? record.publishableKey);

  if (!projectId || !url || !publicValue) {
    throw new Error("A configuração pública do App Piteco está incompleta.");
  }

  const parsedUrl = new URL(url);
  if (
    projectId !== OFFICIAL_SUPABASE_PROJECT_ID
    || parsedUrl.protocol !== "https:"
    || parsedUrl.hostname !== `${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`
  ) {
    throw new Error("O aplicativo tentou conectar a um projeto Supabase diferente do projeto oficial.");
  }

  return { projectId, url, publicValue };
}

function readCachedRuntime(): PlatformRuntime | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    return cached ? validateOfficialRuntime(JSON.parse(cached)) : null;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function cacheRuntime(runtime: PlatformRuntime): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runtime));
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export async function loadOfficialPlatformRuntime(): Promise<PlatformRuntime> {
  const injected = {
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    url: import.meta.env.VITE_SUPABASE_URL,
    publicValue: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  if (injected.projectId && injected.url && injected.publicValue) {
    try {
      const runtime = validateOfficialRuntime(injected);
      cacheRuntime(runtime);
      return runtime;
    } catch (error) {
      console.warn(
        "[PlatformRuntime] A configuração injetada aponta para outro projeto; buscando a configuração oficial.",
        error,
      );
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(OFFICIAL_RUNTIME_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const runtime = validateOfficialRuntime(await response.json());
    cacheRuntime(runtime);
    return runtime;
  } catch {
    const cached = readCachedRuntime();
    if (cached) return cached;
    throw new Error(
      "Não foi possível carregar a configuração oficial do Supabase. Verifique a conexão e tente novamente.",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}
