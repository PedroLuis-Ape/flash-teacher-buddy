import {
  MANAGED_SUPABASE_PROJECT_ID,
  PRODUCTION_DATA_PROJECT_ID,
  PRODUCTION_DATA_RUNTIME,
  PRODUCTION_DATA_URL,
  type PlatformRuntime,
} from "./platformRuntime";

export { MANAGED_SUPABASE_PROJECT_ID, PRODUCTION_DATA_PROJECT_ID } from "./platformRuntime";
export const OFFICIAL_RUNTIME_ENDPOINT = `https://${MANAGED_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/app-public-config`;

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
    projectId !== PRODUCTION_DATA_PROJECT_ID
    || parsedUrl.protocol !== "https:"
    || parsedUrl.hostname !== `${PRODUCTION_DATA_PROJECT_ID}.supabase.co`
  ) {
    throw new Error("A configuração não aponta para o backend de dados em produção.");
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
    console.warn("[RuntimeBootstrap] Ambiente injetado não contém os dados atuais; usando o backend de produção.", error);
    return {
      ...PRODUCTION_DATA_RUNTIME,
      url: PRODUCTION_DATA_URL,
    };
  }
}
