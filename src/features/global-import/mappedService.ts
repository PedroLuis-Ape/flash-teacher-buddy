import { supabase } from "@/integrations/supabase/client";
import {
  legacyPackageToSmartImport,
  smartPackageForEffectiveLegacy,
} from "@/features/smart-import/adapters";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import type { GlobalImportPackage } from "./schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";
import type { CanonicalGlobalImportPackage } from "./schema/globalImportSchema";
import type { AppPitecoSuperImportPackage } from "./schema/appPitecoSuperImportSchema";
import { updateGlobalImportManifestStatus } from "./manifest";

export type CardConflictPolicy = "skip" | "replace" | "copy" | "error";
export type ImportTargetScope = "personal" | "classroom";

export interface ExecuteMappedImportOptions {
  requestId?: string;
  officialPackage?: AppPitecoSuperImportPackage | null;
  canonicalPackage?: CanonicalGlobalImportPackage | null;
  smartPackage?: SmartImportPackage | null;
  destinationPlan: GlobalImportDestinationPlan;
  catalog: ImportDestinationCatalog;
  cardConflict: CardConflictPolicy;
  institutionId?: string | null;
  turmaId?: string | null;
  onProgress?: (completed: number, total: number, label: string) => void;
}

export interface GlobalImportExecutionReport {
  batch_id: string;
  request_id: string;
  status: "completed" | "undone";
  package_name: string;
  folders_created: number;
  folders_reused: number;
  lists_created: number;
  lists_reused: number;
  lists_replaced?: number;
  lists_skipped?: number;
  cards_created: number;
  cards_updated?: number;
  cards_skipped: number;
  layered_groups_created?: number;
  glossary_created?: number;
  glossary_updated?: number;
  glossary_skipped?: number;
  glossary_scope?: "folder";
  assignments_created?: number;
  target_scope?: ImportTargetScope;
  turma_id?: string;
  schema?: "app-piteco-super-import";
  version?: "1.0" | "2.0";
  format?: "ape-global-import";
  schema_version?: 1 | 2;
}

const memoryRequestIds = new Map<string, string>();

function countCards(packageValue: GlobalImportPackage): number {
  return packageValue.package.folders.reduce(
    (folderTotal, folder) => folderTotal + folder.lists.reduce(
      (listTotal, list) => listTotal + list.cards.length,
      0,
    ),
    0,
  );
}

export function stripGlossariesForFolderImport<T>(packageValue: T): T {
  const clone = JSON.parse(JSON.stringify(packageValue)) as T;
  const packageRecord = clone as {
    package?: {
      folders?: Array<{
        glossary?: unknown;
        lists?: Array<{ glossary?: unknown }>;
      }>;
    };
  };

  for (const folder of packageRecord.package?.folders ?? []) {
    delete folder.glossary;
    for (const list of folder.lists ?? []) delete list.glossary;
  }
  return clone;
}

function requestStorageKey(
  packageValue: GlobalImportPackage,
  smartPackage: SmartImportPackage,
  options: ExecuteMappedImportOptions,
): string {
  const text = JSON.stringify({
    packageValue,
    smartPackage,
    destinationPlan: options.destinationPlan,
    cardConflict: options.cardConflict,
    institutionId: options.institutionId ?? null,
    turmaId: options.turmaId ?? null,
  });
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `global-import-request:${(hash >>> 0).toString(16)}`;
}

function getOrCreateRequestId(
  packageValue: GlobalImportPackage,
  smartPackage: SmartImportPackage,
  options: ExecuteMappedImportOptions,
): { requestId: string; storageKey: string } {
  const storageKey = requestStorageKey(packageValue, smartPackage, options);
  const provided = options.requestId
    ?? (options.turmaId ? undefined : options.canonicalPackage?.request_id);
  if (provided) return { requestId: provided, storageKey };

  const stored = typeof window !== "undefined"
    ? window.sessionStorage.getItem(storageKey)
    : memoryRequestIds.get(storageKey) ?? null;
  if (stored) return { requestId: stored, storageKey };

  const requestId = crypto.randomUUID();
  if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, requestId);
  else memoryRequestIds.set(storageKey, requestId);
  return { requestId, storageKey };
}

function clearRequestId(storageKey: string): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey);
  memoryRequestIds.delete(storageKey);
}

function databaseErrorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return {
      code: "code" in error ? String((error as Error & { code?: unknown }).code ?? "") : "",
      message: error.message,
    };
  }
  if (typeof error === "object" && error !== null) {
    const record = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
    return {
      code: String(record.code ?? ""),
      message: [record.message, record.details, record.hint]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" "),
    };
  }
  return { code: "", message: String(error ?? "") };
}

export function isMissingRpcSchemaCacheError(error: unknown, rpcName?: string): boolean {
  const { code, message } = databaseErrorDetails(error);
  const normalized = message.toLowerCase();
  const missingFromCache = code === "PGRST202"
    || (
      normalized.includes("could not find the function")
      && normalized.includes("schema cache")
    );
  if (!missingFromCache) return false;
  return !rpcName || normalized.includes(rpcName.toLowerCase());
}

function importDatabaseError(error: unknown): Error {
  const { message } = databaseErrorDetails(error);

  if (
    message.includes("global_import_batches_schema_version_check")
    || (message.includes("global_import_batches") && message.includes("schema_version"))
  ) {
    return new Error(
      "O banco conectado ao preview ainda não recebeu a migration do Super Importador 2.0. "
      + "Aplique a migration 20260623003000_fix_global_import_batch_schema_version_v2.sql e tente novamente.",
    );
  }

  return error instanceof Error ? error : new Error(message || "A importação falhou no banco de dados.");
}

async function runUndoRpc(
  batchId: string,
  targetScope: ImportTargetScope,
): Promise<{ error: unknown }> {
  const currentName = targetScope === "classroom"
    ? "undo_classroom_global_import_v2"
    : "undo_global_import_v2";
  const legacyName = targetScope === "classroom"
    ? "undo_classroom_global_import_v1"
    : "undo_global_import_v1";
  const current = await (supabase.rpc as any)(currentName, { _batch_id: batchId });
  if (current.error && isMissingRpcSchemaCacheError(current.error, currentName)) {
    return (supabase.rpc as any)(legacyName, { _batch_id: batchId });
  }
  return current;
}

async function rollbackImportedBatch(
  batchId: string,
  targetScope: ImportTargetScope,
): Promise<void> {
  await runUndoRpc(batchId, targetScope);
}

export async function executeMappedGlobalImport(
  packageValue: GlobalImportPackage,
  options: ExecuteMappedImportOptions,
): Promise<GlobalImportExecutionReport> {
  const totalCards = countCards(packageValue);
  const sourceSmart = options.smartPackage ?? legacyPackageToSmartImport(packageValue);
  const smartPackage = smartPackageForEffectiveLegacy(sourceSmart, packageValue);
  const cardPackage = stripGlossariesForFolderImport(smartPackage);
  const request = getOrCreateRequestId(packageValue, smartPackage, options);

  if (
    !options.turmaId
    && options.canonicalPackage
    && options.requestId
    && options.requestId !== options.canonicalPackage.request_id
  ) {
    throw new Error("O request_id informado não corresponde ao pacote canônico.");
  }

  options.onProgress?.(
    0,
    totalCards,
    options.turmaId
      ? "Enviando o pacote para uma transação segura dentro da turma"
      : "Enviando pacote enriquecido para uma transação segura",
  );

  const rpcName = options.turmaId
    ? "import_app_piteco_super_package_to_class_v2"
    : "import_app_piteco_super_package_v3";
  const legacyRpcName = options.turmaId
    ? "import_app_piteco_super_package_to_class_v1"
    : "import_app_piteco_super_package_v2";
  const rpcPayload = options.turmaId
    ? {
        _request_id: request.requestId,
        _payload: cardPackage,
        _destination_plan: options.destinationPlan,
        _turma_id: options.turmaId,
        _card_conflict: options.cardConflict,
      }
    : {
        _request_id: request.requestId,
        _payload: cardPackage,
        _destination_plan: options.destinationPlan,
        _card_conflict: options.cardConflict,
        _institution_id: options.institutionId ?? null,
      };

  let rpcResult = await (supabase.rpc as any)(rpcName, rpcPayload);
  let usedLegacyOfficialFallback = false;

  if (
    rpcResult.error
    && options.cardConflict !== "replace"
    && isMissingRpcSchemaCacheError(rpcResult.error, rpcName)
  ) {
    rpcResult = await (supabase.rpc as any)(legacyRpcName, rpcPayload);
  }

  if (
    rpcResult.error
    && !options.turmaId
    && options.cardConflict !== "replace"
    && options.officialPackage
    && options.officialPackage.version === "1.0"
    && isMissingRpcSchemaCacheError(rpcResult.error, legacyRpcName)
  ) {
    options.onProgress?.(
      0,
      totalCards,
      "O motor 2.0 não está disponível neste banco; usando o importador oficial compatível",
    );

    rpcResult = await (supabase.rpc as any)(
      "import_app_piteco_super_package_v1",
      {
        _request_id: request.requestId,
        _payload: options.officialPackage,
        _destination_plan: options.destinationPlan,
        _card_conflict: options.cardConflict,
        _institution_id: options.institutionId ?? null,
      },
    );
    usedLegacyOfficialFallback = !rpcResult.error;

    if (
      rpcResult.error
      && isMissingRpcSchemaCacheError(rpcResult.error, "import_app_piteco_super_package_v1")
    ) {
      throw new Error(
        "O banco conectado ao aplicativo não publicou os motores do Super Importador. "
        + "As funções atuais e compatíveis estão ausentes do cache de schema deste backend.",
      );
    }
  }

  const { data, error } = rpcResult;
  if (error) {
    if (options.cardConflict === "replace" && isMissingRpcSchemaCacheError(error, rpcName)) {
      throw new Error("O banco ainda não recebeu a migration da política de substituir duplicados.");
    }
    throw importDatabaseError(error);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("O banco não devolveu o relatório da importação.");
  }

  const baseReport = data as GlobalImportExecutionReport;

  if (usedLegacyOfficialFallback) {
    const finalReport: GlobalImportExecutionReport = {
      ...baseReport,
      target_scope: "personal",
      glossary_scope: "folder",
      glossary_created: 0,
      glossary_updated: 0,
      glossary_skipped: 0,
    };
    if (options.canonicalPackage) {
      updateGlobalImportManifestStatus(options.canonicalPackage.request_id, "imported");
    }
    clearRequestId(request.storageKey);
    options.onProgress?.(totalCards, totalCards, "Importação concluída pelo motor compatível");
    return finalReport;
  }

  options.onProgress?.(
    totalCards,
    totalCards,
    "Consolidando o glossário dentro de cada pasta",
  );

  const { data: glossaryData, error: glossaryError } = await (supabase.rpc as any)(
    "sync_folder_glossaries_from_super_import_v1",
    {
      _batch_id: baseReport.batch_id,
      _payload: smartPackage,
    },
  );

  if (glossaryError) {
    await rollbackImportedBatch(
      baseReport.batch_id,
      options.turmaId ? "classroom" : "personal",
    );
    throw importDatabaseError(glossaryError);
  }

  const glossaryReport = (glossaryData ?? {}) as {
    glossary_created?: number;
    glossary_updated?: number;
    glossary_skipped?: number;
  };
  const finalReport: GlobalImportExecutionReport = {
    ...baseReport,
    glossary_scope: "folder",
    glossary_created: glossaryReport.glossary_created ?? 0,
    glossary_updated: glossaryReport.glossary_updated ?? 0,
    glossary_skipped: glossaryReport.glossary_skipped ?? 0,
  };

  if (options.canonicalPackage) {
    updateGlobalImportManifestStatus(options.canonicalPackage.request_id, "imported");
  }
  clearRequestId(request.storageKey);
  options.onProgress?.(totalCards, totalCards, "Importação concluída");
  return finalReport;
}

export async function undoGlobalImport(
  batchId: string,
  targetScope: ImportTargetScope = "personal",
): Promise<void> {
  const folderUndo = await (supabase.rpc as any)(
    "undo_folder_glossary_batch_v1",
    { _batch_id: batchId },
  );
  if (folderUndo.error) throw importDatabaseError(folderUndo.error);

  const { error } = await runUndoRpc(batchId, targetScope);
  if (error) throw importDatabaseError(error);
}
