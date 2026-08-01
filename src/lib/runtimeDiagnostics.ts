import { PRODUCTION_DATA_PROJECT_ID } from "@/integrations/supabase/platformRuntime";

export type RuntimeConfigInput = {
  projectId?: string;
  url?: string;
  publicValue?: string;
};

export type RuntimeDiagnostic = {
  status: "ok" | "warning" | "error";
  code: "BUILT_IN_RUNTIME" | "CONFIG_INCOMPLETE" | "CONFIG_INVALID" | "CONFIG_VALID";
  message: string;
  action: string;
  source: "injected" | "built-in";
};

function present(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function looksLikePublicSupabaseKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.split(".").length === 3;
}

/**
 * Validates only public runtime metadata. It never returns a secret or the
 * supplied key value, and it intentionally does not contact Supabase.
 */
export function diagnoseRuntimeConfig(
  input: RuntimeConfigInput,
  expectedProjectId = PRODUCTION_DATA_PROJECT_ID,
): RuntimeDiagnostic {
  const projectId = present(input.projectId);
  const url = present(input.url);
  const publicValue = present(input.publicValue);
  const supplied = [projectId, url, publicValue].filter(Boolean).length;

  if (supplied === 0) {
    return {
      status: "warning",
      code: "BUILT_IN_RUNTIME",
      message: "Nenhum override público foi injetado; o runtime oficial embutido será usado.",
      action: "Nenhuma ação necessária para o preview técnico.",
      source: "built-in",
    };
  }

  if (supplied !== 3) {
    return {
      status: "error",
      code: "CONFIG_INCOMPLETE",
      message: "A configuração pública do ambiente está incompleta.",
      action: "Configure URL, project ref e chave pública como um conjunto.",
      source: "injected",
    };
  }

  try {
    const parsedUrl = new URL(url);
    const validUrl =
      parsedUrl.protocol === "https:" &&
      parsedUrl.hostname === `${expectedProjectId}.supabase.co` &&
      (parsedUrl.pathname === "" || parsedUrl.pathname === "/");

    if (projectId !== expectedProjectId || !validUrl || !looksLikePublicSupabaseKey(publicValue)) {
      return {
        status: "error",
        code: "CONFIG_INVALID",
        message: "A configuração pública não corresponde ao backend oficial esperado.",
        action: "Corrija o project ref, a URL HTTPS e a chave pública no ambiente do preview.",
        source: "injected",
      };
    }
  } catch {
    return {
      status: "error",
      code: "CONFIG_INVALID",
      message: "A URL pública do backend não é válida.",
      action: "Corrija a URL HTTPS no ambiente do preview.",
      source: "injected",
    };
  }

  return {
    status: "ok",
    code: "CONFIG_VALID",
    message: "Configuração pública validada sem expor valores sensíveis.",
    action: "Nenhuma ação necessária.",
    source: "injected",
  };
}
