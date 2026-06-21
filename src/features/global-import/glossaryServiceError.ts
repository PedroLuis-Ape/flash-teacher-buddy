export type GlossaryServiceAction = "analisar" | "importar" | "sincronizar";

interface SupabaseLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

function rawErrorText(error: unknown) {
  if (!error || typeof error !== "object") return String(error ?? "");
  const value = error as SupabaseLikeError;
  return [value.code, value.message, value.details, value.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isMissingGlossaryRpcError(error: unknown) {
  const text = rawErrorText(error);
  const code = typeof error === "object" && error ? String((error as SupabaseLikeError).code ?? "") : "";
  return code === "PGRST202"
    || text.includes("schema cache")
    || text.includes("could not find the function")
    || text.includes("import_account_glossary_v1");
}

export function isMissingGlossaryTableError(error: unknown) {
  const text = rawErrorText(error);
  const code = typeof error === "object" && error ? String((error as SupabaseLikeError).code ?? "") : "";
  return code === "PGRST205"
    || code === "42P01"
    || text.includes("account_glossary") && (text.includes("does not exist") || text.includes("schema cache"));
}

export function glossaryServiceMessage(error: unknown, action: GlossaryServiceAction) {
  const value = (error ?? {}) as SupabaseLikeError;
  const text = rawErrorText(error);

  if (isMissingGlossaryRpcError(error)) {
    return action === "analisar"
      ? "O arquivo foi validado, mas o serviço de análise ainda não foi reconhecido pelo Supabase. Aguarde alguns segundos e tente novamente."
      : "O arquivo foi validado, mas a função de importação não está disponível no banco conectado. Verifique se as migrations da Caixa de Glossário foram publicadas neste mesmo ambiente.";
  }

  if (isMissingGlossaryTableError(error)) {
    return "A Caixa de Glossário não existe no Supabase conectado. O aplicativo e as migrations podem estar apontando para projetos diferentes.";
  }

  if (value.status === 401 || value.status === 403 || value.code === "42501" || text.includes("jwt") || text.includes("permission")) {
    return "Sua sessão não tem permissão para acessar a Caixa de Glossário. Entre novamente e repita a operação.";
  }

  if (text.includes("failed to fetch") || text.includes("network")) {
    return "Não foi possível alcançar o Supabase. Verifique a conexão e tente novamente.";
  }

  const fallback = typeof value.message === "string" && value.message.trim()
    ? value.message.trim()
    : `Não foi possível ${action} o glossário.`;
  return fallback;
}

export function configuredSupabaseProjectRef() {
  const configured = String(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "").trim();
  if (configured) return configured;

  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const match = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match?.[1] ?? "não identificado";
}
