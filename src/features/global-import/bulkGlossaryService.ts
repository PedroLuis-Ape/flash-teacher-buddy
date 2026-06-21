import { supabase } from "@/integrations/supabase/client";
import { glossaryEntryIdentity, normalizeGlossaryValue, type GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";

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

const db = supabase as any;
const note = (value?: string | null) => value?.trim() || null;

export async function importGlossaryToFolders(options: BulkGlossaryImportOptions): Promise<BulkGlossaryImportReport> {
  const folderIds = [...new Set(options.folderIds)];
  if (!folderIds.length || !options.entries.length) throw new Error("Selecione pastas e informe o glossário.");

  let listQuery = db.from("lists").select("id, folder_id").in("folder_id", folderIds).is("deleted_at", null);
  listQuery = options.turmaId ? listQuery.eq("class_id", options.turmaId) : listQuery.is("class_id", null);
  const { data: lists, error: listError } = await listQuery;
  if (listError) throw listError;
  const listIds = (lists ?? []).map((row: { id: string }) => row.id);
  if (!listIds.length) throw new Error("As pastas selecionadas não possuem listas.");

  const { data: current, error: glossaryError } = await db
    .from("list_glossary")
    .select("id, list_id, original_text, translated_text, note, side, is_active")
    .in("list_id", listIds);
  if (glossaryError) throw glossaryError;

  const exact = new Map<string, any>();
  const terms = new Set<string>();
  for (const row of current ?? []) {
    exact.set(`${row.list_id}|${glossaryEntryIdentity(row)}`, row);
    terms.add(`${row.list_id}|${row.side}|${normalizeGlossaryValue(row.original_text)}`);
  }

  const inserts: any[] = [];
  const updates: any[] = [];
  let skipped = 0;
  let layers = 0;
  for (const listId of listIds) for (const entry of options.entries) {
    const found = exact.get(`${listId}|${glossaryEntryIdentity(entry)}`);
    if (found) {
      if (note(found.note) !== note(entry.note) || found.is_active !== entry.is_active) updates.push({ id: found.id, note: note(entry.note), is_active: entry.is_active });
      else skipped += 1;
    } else {
      if (terms.has(`${listId}|${entry.side}|${normalizeGlossaryValue(entry.original_text)}`)) layers += 1;
      inserts.push({ ...entry, note: note(entry.note), list_id: listId });
    }
  }

  const requires = updates.length + skipped + layers > 0;
  const report: BulkGlossaryImportReport = {
    success: true,
    dry_run: requires && !options.confirmExisting,
    requires_confirmation: requires,
    folders_targeted: folderIds.length,
    lists_targeted: listIds.length,
    entries_received: options.entries.length,
    total_applications: listIds.length * options.entries.length,
    inserted: inserts.length,
    updated: updates.length,
    skipped_exact: skipped,
    added_as_layer: layers,
  };
  if (report.dry_run) return report;

  for (let index = 0; index < inserts.length; index += 100) {
    const { error } = await db.from("list_glossary").insert(inserts.slice(index, index + 100));
    if (error) throw error;
  }
  for (const entry of updates) {
    const { error } = await db.from("list_glossary").update({ note: entry.note, is_active: entry.is_active, updated_at: new Date().toISOString() }).eq("id", entry.id);
    if (error) throw error;
  }
  return { ...report, dry_run: false };
}
