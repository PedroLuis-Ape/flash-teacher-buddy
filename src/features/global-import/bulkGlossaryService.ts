import { supabase } from "@/integrations/supabase/client";
import type { BulkGlossaryReport, BulkGlossaryRequest } from "./bulkGlossary";
import { glossaryServiceMessage, isMissingGlossaryRpcError } from "./glossaryServiceError";

interface AccountGlossaryRpcReport extends Omit<BulkGlossaryReport, "selected_folders"> {
  selected_folders?: number;
  scope?: "account";
}

function serializeEntries(request: BulkGlossaryRequest) {
  return request.entries.map((entry) => ({
    original_text: entry.original_text,
    translated_text: entry.translated_text,
    note: entry.note ?? null,
    side: entry.side,
    is_active: entry.is_active,
  }));
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function runAccountImport(
  request: BulkGlossaryRequest,
  dryRun: boolean,
): Promise<BulkGlossaryReport> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await (supabase as any).rpc("import_account_glossary_v1", {
      _entries: serializeEntries(request),
      _dry_run: dryRun,
    });

    if (!error) {
      const report = (data ?? {}) as AccountGlossaryRpcReport;
      return {
        success: report.success === true,
        dry_run: report.dry_run === true,
        requires_confirmation: report.requires_confirmation === true,
        selected_folders: report.selected_folders ?? 0,
        target_lists: Number(report.target_lists ?? 0),
        glossary_entries: Number(report.glossary_entries ?? request.entries.length),
        planned_applications: Number(report.planned_applications ?? request.entries.length),
        inserted: Number(report.inserted ?? 0),
        updated: Number(report.updated ?? 0),
        skipped: Number(report.skipped ?? 0),
        exact_existing: Number(report.exact_existing ?? 0),
        alternative_layers: Number(report.alternative_layers ?? 0),
        message: "Glossário salvo uma única vez na caixa central da conta.",
      };
    }

    lastError = error;
    if (!isMissingGlossaryRpcError(error) || attempt === 2) break;
    await wait(400 * (attempt + 1));
  }

  throw new Error(glossaryServiceMessage(lastError, dryRun ? "analisar" : "importar"));
}

export async function previewBulkGlossaryImport(
  request: BulkGlossaryRequest,
): Promise<BulkGlossaryReport> {
  return runAccountImport(request, true);
}

export async function applyBulkGlossaryImport(
  request: BulkGlossaryRequest,
  _confirmExisting: boolean,
): Promise<BulkGlossaryReport> {
  return runAccountImport(request, false);
}
