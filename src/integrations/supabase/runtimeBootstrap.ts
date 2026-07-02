import {
  OFFICIAL_RUNTIME,
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
    throw new Error("O aplicativo tentou conectar a um projeto Supabase diferente do projeto oficial.");
  }

  return { projectId, url, publicValue };
}

export async function loadOfficialPlatformRuntime(): Promise<PlatformRuntime> {
  const injected = {
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    url: import.meta.env.VITE_SUPABASE_URL,
    publicValue: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  try {
    return validateOfficialRuntime(injected);
  } catch (error) {
    console.warn("[RuntimeBootstrap] Ambiente injetado inválido; usando configuração oficial.", error);
    return { ...OFFICIAL_RUNTIME };
  }
}
