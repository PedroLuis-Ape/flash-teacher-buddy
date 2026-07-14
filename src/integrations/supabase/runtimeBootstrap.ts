import {
  OFFICIAL_SUPABASE_PROJECT_ID,
  OFFICIAL_SUPABASE_URL,
  type PlatformRuntime,
} from "./platformRuntime";

export { OFFICIAL_SUPABASE_PROJECT_ID } from "./platformRuntime";
export const OFFICIAL_RUNTIME_ENDPOINT = `${OFFICIAL_SUPABASE_URL}/functions/v1/app-public-config`;

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
    throw new Error("A configuração não aponta para o projeto Supabase oficial do App Piteco.");
  }

  return { projectId, url: parsedUrl.origin, publicValue };
}

export async function loadOfficialPlatformRuntime(
  fetchImpl: typeof fetch = fetch,
): Promise<PlatformRuntime> {
  const injected = {
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    url: import.meta.env.VITE_SUPABASE_URL,
    publicValue: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  try {
    return validateOfficialRuntime(injected);
  } catch {
    // Production can obtain the public browser configuration from the official
    // project before any Supabase client is imported.
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImpl(OFFICIAL_RUNTIME_ENDPOINT, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`app-public-config respondeu HTTP ${response.status}.`);
    }
    return validateOfficialRuntime(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
