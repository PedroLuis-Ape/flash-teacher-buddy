import { supabase } from "@/integrations/supabase/client";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";

export interface BulkGlossaryImportReport {
  success: boolean;
  dry_run: boolean;
  requires_confirmation: boolean;
  folders_targeted: number;
  lists_targeted: number;
  entries_received: number;
  total_applications: number;
  inserted: number;
  updated: number;
  skipped_exact: number;
  added_as_layer: number;
}

export interface BulkGlossaryImportOptions {
  folderIds: string[];
  entries: GlossaryTransferEntry[];
  turmaId?: string | null;
  confirmExisting?: boolean;
}

export async function importGlossaryToFolders(options: BulkGlossaryImportOptions) {
  const { data, error } = await (supabase.rpc as any)("bulk_import_glossary_to_folders_v1", {
    _folder_ids: options.folderIds,
    _entries: options.entries,
    _confirm_existing: options.confirmExisting ?? false,
    _turma_id: options.turmaId ?? null,
  });
  if (error) throw error;
  return data as BulkGlossaryImportReport;
}
