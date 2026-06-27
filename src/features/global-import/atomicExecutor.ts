import { supabase } from "@/integrations/supabase/client";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import type { GlobalImportDestinationPlan } from "./destination";
import type { CardConflictPolicy, GlobalImportExecutionReport } from "./mappedService";

interface AtomicImportOptions {
  requestId: string;
  cardPayload: SmartImportPackage;
  glossaryPayload: SmartImportPackage;
  destinationPlan: GlobalImportDestinationPlan;
  cardConflict: CardConflictPolicy;
  institutionId?: string | null;
  turmaId?: string | null;
}

interface RpcErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function rpcErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const value = error as RpcErrorLike;
  return [value.code, value.message, value.details, value.hint].filter(Boolean).join(" ");
}

export function atomicImportDatabaseError(error: unknown): Error {
  const text = rpcErrorText(error);
  const lower = text.toLocaleLowerCase();

  if (
    lower.includes("pgrst202")
    || lower.includes("could not find the function")
    || lower.includes("schema cache")
  ) {
    return new Error(
      "O servidor ainda não reconheceu o contrato atômico do Super Importador. "
      + "Atualize a página e tente novamente; se persistir, publique a migration atomic_super_import_v3.",
    );
  }

  if (lower.includes("global_import_batches_schema_version_check")) {
    return new Error("O banco não está preparado para lotes do Super Importador 2.0.");
  }

  return error instanceof Error ? error : new Error(text || "A importação falhou no banco de dados.");
}

export async function executeAtomicSuperImport(
  options: AtomicImportOptions,
): Promise<GlobalImportExecutionReport> {
  const { data, error } = await (supabase.rpc as any)(
    "execute_app_piteco_super_import_v3",
    {
      _request_id: options.requestId,
      _card_payload: options.cardPayload,
      _glossary_payload: options.glossaryPayload,
      _destination_plan: options.destinationPlan,
      _card_conflict: options.cardConflict,
      _institution_id: options.institutionId ?? null,
      _turma_id: options.turmaId ?? null,
    },
  );

  if (error) throw atomicImportDatabaseError(error);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("O banco não devolveu o relatório da importação atômica.");
  }

  return data as GlobalImportExecutionReport;
}
