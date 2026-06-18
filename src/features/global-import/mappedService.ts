import { supabase } from "@/integrations/supabase/client";
import type { GlobalImportPackage } from "./schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";

export type CardConflictPolicy = "skip" | "copy" | "error";

export interface ExecuteMappedImportOptions {
  requestId?: string;
  destinationPlan: GlobalImportDestinationPlan;
  catalog: ImportDestinationCatalog;
  cardConflict: CardConflictPolicy;
  institutionId?: string | null;
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

function requestStorageKey(
  packageValue: GlobalImportPackage,
  options: ExecuteMappedImportOptions,
): string {
  const text = JSON.stringify({
    packageValue,
    destinationPlan: options.destinationPlan,
    cardConflict: options.cardConflict,
    institutionId: options.institutionId ?? null,
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
  options: ExecuteMappedImportOptions,
): { requestId: string; storageKey: string } {
  const storageKey = requestStorageKey(packageValue, options);
  if (options.requestId) return { requestId: options.requestId, storageKey };

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
  const { requestId, storageKey } = getOrCreateRequestId(packageValue, options);
  options.onProgress?.(0, totalCards, "Enviando pacote para uma transação segura");

  const { data, error } = await (supabase.rpc as any)("import_global_package_v1", {
    _request_id: requestId,
    _payload: packageValue,
    _destination_plan: options.destinationPlan,
    _card_conflict: options.cardConflict,
    _institution_id: options.institutionId ?? null,
  });

  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("O banco não devolveu o relatório da importação.");
  }

  clearRequestId(storageKey);
  options.onProgress?.(totalCards, totalCards, "Importação concluída");
  return data as GlobalImportExecutionReport;
}

export async function undoGlobalImport(batchId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("undo_global_import_v1", {
    _batch_id: batchId,
  });
  if (error) throw error;
}
