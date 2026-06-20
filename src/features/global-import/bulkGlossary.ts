import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";
import type { ImportDestinationCatalog } from "./destination";

export interface BulkGlossaryReport {
  success: boolean;
  dry_run: boolean;
  requires_confirmation: boolean;
  selected_folders: number;
  target_lists: number;
  glossary_entries: number;
  planned_applications: number;
  inserted: number;
  updated: number;
  skipped: number;
  exact_existing: number;
  alternative_layers: number;
  message?: string;
}

export interface BulkGlossaryRequest {
  folderIds: string[];
  entries: GlossaryTransferEntry[];
  turmaId?: string | null;
}

export function folderListCount(catalog: ImportDestinationCatalog | null, folderIds: readonly string[]): number {
  if (!catalog || folderIds.length === 0) return 0;
  const selected = new Set(folderIds);
  return catalog.lists.filter((list) => selected.has(list.folder_id)).length;
}

export function glossaryApplicationsCount(entryCount: number, listCount: number): number {
  return Math.max(0, entryCount) * Math.max(0, listCount);
}
