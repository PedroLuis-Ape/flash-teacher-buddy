import { supabase } from "@/integrations/supabase/client";
import {
  legacyPackageToSmartImport,
  smartPackageForEffectiveLegacy,
} from "@/features/smart-import/adapters";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { atomicImportDatabaseError, executeAtomicSuperImport } from "./atomicExecutor";
import type { GlobalImportPackage } from "./schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";
import type { CanonicalGlobalImportPackage } from "./schema/globalImportSchema";
import type { AppPitecoSuperImportPackage } from "./schema/appPitecoSuperImportSchema";
import { updateGlobalImportManifestStatus } from "./manifest";

export type CardConflictPolicy = "skip" | "copy" | "error";
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
      ? "Importando cards e glossário em uma transação segura na turma"
      : "Importando cards e glossário em uma transação segura",
  );

  const finalReport = await executeAtomicSuperImport({
    requestId: request.requestId,
    cardPayload: cardPackage,
    glossaryPayload: smartPackage,
    destinationPlan: options.destinationPlan,
    cardConflict: options.cardConflict,
    institutionId: options.institutionId,
    turmaId: options.turmaId,
  });

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
  if (folderUndo.error) throw atomicImportDatabaseError(folderUndo.error);

  const rpcName = targetScope === "classroom"
    ? "undo_classroom_global_import_v1"
    : "undo_global_import_v1";
  const { error } = await (supabase.rpc as any)(rpcName, {
    _batch_id: batchId,
  });
  if (error) throw atomicImportDatabaseError(error);
}
