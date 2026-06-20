import { supabase } from "@/integrations/supabase/client";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";
import type { BulkGlossaryReport, BulkGlossaryRequest } from "./bulkGlossary";

function buildArgs(request: BulkGlossaryRequest, dryRun: boolean, confirmExisting: boolean) {
  return {
    _folder_ids: request.folderIds,
    _entries: request.entries as GlossaryTransferEntry[],
    _turma_id: request.turmaId ?? null,
    _dry_run: dryRun,
    _confirm_existing: confirmExisting,
  };
}

async function execute(request: BulkGlossaryRequest, dryRun: boolean, confirmExisting: boolean): Promise<BulkGlossaryReport> {
  const { data, error } = await supabase.rpc(
    "bulk_import_glossary_to_folders_v1" as never,
    buildArgs(request, dryRun, confirmExisting) as never,
  );
  if (error) throw error;
  return data as BulkGlossaryReport;
}

export function previewBulkGlossaryImport(request: BulkGlossaryRequest) {
  return execute(request, true, false);
}

export function applyBulkGlossaryImport(request: BulkGlossaryRequest, confirmExisting: boolean) {
  return execute(request, false, confirmExisting);
}
