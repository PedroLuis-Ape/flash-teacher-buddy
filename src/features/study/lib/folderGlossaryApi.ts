import { supabase } from "@/integrations/supabase/client";
import type { GlossaryTransferEntry } from "./glossaryTransfer";
import type { FolderGlossaryEntry, FolderGlossaryImportMode, FolderGlossaryImportResult } from "./folderGlossaryTypes";

const PAGE_SIZE = 1000;

export async function resolveFolderIdForList(listId: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("resolve_folder_id_for_list_v1", { _list_id: listId });
  if (error) throw error;
  return (data ?? null) as string | null;
}

export async function loadFolderGlossary(folderId: string, includeInactive = false): Promise<FolderGlossaryEntry[]> {
  const rows: FolderGlossaryEntry[] = [];
  let from = 0;
  while (true) {
    let query = (supabase as any)
      .from("folder_glossary")
      .select("*")
      .eq("folder_id", folderId)
      .order("side", { ascending: true })
      .order("original_text", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as FolderGlossaryEntry[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export async function loadFolderGlossaryForList(listId: string): Promise<FolderGlossaryEntry[]> {
  const { data, error } = await (supabase as any).rpc("get_folder_glossary_for_list_v1", { _list_id: listId });
  if (error) throw error;
  return (data ?? []) as FolderGlossaryEntry[];
}

export async function addFolderGlossaryEntry(folderId: string, entry: GlossaryTransferEntry) {
  const { error } = await (supabase as any).from("folder_glossary").insert({
    ...entry,
    folder_id: folderId,
    note: entry.note ?? null,
    is_active: entry.is_active ?? true,
  });
  if (error) throw error;
}

export async function updateFolderGlossaryEntry(id: string, fields: Partial<GlossaryTransferEntry>) {
  const { error } = await (supabase as any)
    .from("folder_glossary")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFolderGlossaryEntries(ids: string[]) {
  const chunkSize = 250;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const { error } = await (supabase as any)
      .from("folder_glossary")
      .delete()
      .in("id", ids.slice(index, index + chunkSize));
    if (error) throw error;
  }
}

export async function importFolderGlossary(
  folderId: string,
  entries: GlossaryTransferEntry[],
  mode: FolderGlossaryImportMode = "merge",
  dryRun = false,
): Promise<FolderGlossaryImportResult> {
  const { data, error } = await (supabase as any).rpc("import_folder_glossary_v1", {
    _folder_id: folderId,
    _entries: entries,
    _mode: mode,
    _dry_run: dryRun,
  });
  if (error) throw error;
  return {
    inserted: Number(data?.inserted ?? 0),
    updated: Number(data?.updated ?? 0),
    replaced: Number(data?.replaced ?? 0),
    skipped: Number(data?.skipped ?? 0),
  };
}

export async function loadFolderScopedGlossary(folderId: string): Promise<FolderGlossaryEntry[]> {
  return loadFolderGlossary(folderId, false);
}
