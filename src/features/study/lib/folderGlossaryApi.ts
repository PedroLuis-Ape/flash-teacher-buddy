import { supabase } from "@/integrations/supabase/client";
import type { AccountGlossaryEntry } from "./accountGlossaryTypes";
import type {
  FolderGlossaryEntry,
  FolderGlossaryImportResult,
  FolderGlossaryInput,
  FolderGlossaryQueryResult,
} from "./folderGlossaryTypes";

export { syncFolderGlossary } from "./folderGlossarySyncApi";

export async function loadFolderGlossary(folderId: string): Promise<FolderGlossaryQueryResult> {
  const [{ data, error }, permission] = await Promise.all([
    (supabase as any).rpc("get_folder_glossary_v1", { _folder_id: folderId }),
    (supabase as any).rpc("can_manage_folder_glossary_v1", { _folder_id: folderId }),
  ]);
  if (error) throw error;
  if (permission.error) throw permission.error;
  return {
    entries: (data ?? []) as FolderGlossaryEntry[],
    canEdit: permission.data === true,
  };
}

export async function loadFolderGlossaryForList(listId: string): Promise<AccountGlossaryEntry[]> {
  const { data, error } = await (supabase as any).rpc(
    "get_folder_glossary_for_list_v1",
    { _list_id: listId },
  );
  if (error) throw error;
  return (data ?? []) as AccountGlossaryEntry[];
}

export async function importFolderGlossary(
  folderId: string,
  entries: FolderGlossaryInput[],
  mode: "merge" | "replace" = "merge",
  dryRun = false,
): Promise<FolderGlossaryImportResult> {
  const { data, error } = await (supabase as any).rpc(
    "import_folder_glossary_v1",
    {
      _folder_id: folderId,
      _entries: entries,
      _mode: mode,
      _dry_run: dryRun,
    },
  );
  if (error) throw error;
  return data as FolderGlossaryImportResult;
}

export async function addFolderGlossaryEntry(
  folderId: string,
  entry: FolderGlossaryInput,
): Promise<void> {
  const { error } = await (supabase as any).from("folder_glossary").insert({
    folder_id: folderId,
    original_text: entry.term,
    primary_translation: entry.translation,
    alternative_translations: entry.alternatives ?? [],
    note: entry.note ?? null,
    side: entry.side ?? "A",
    source_language: entry.source_language ?? null,
    target_language: entry.target_language ?? null,
    is_active: entry.active ?? true,
  });
  if (error) throw error;
}

export async function updateFolderGlossaryEntry(
  id: string,
  fields: Partial<FolderGlossaryEntry>,
): Promise<void> {
  const allowed = {
    original_text: fields.original_text,
    primary_translation: fields.primary_translation,
    alternative_translations: fields.alternative_translations,
    note: fields.note,
    side: fields.side,
    source_language: fields.source_language,
    target_language: fields.target_language,
    is_active: fields.is_active,
  };
  const values = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined),
  );
  const { error } = await (supabase as any)
    .from("folder_glossary")
    .update(values)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFolderGlossaryEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await (supabase as any)
    .from("folder_glossary")
    .delete()
    .in("id", ids);
  if (error) throw error;
}
