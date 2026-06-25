import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import type { AccountGlossaryEntry } from "./accountGlossaryTypes";
import type {
  FolderGlossaryEntry,
  FolderGlossaryImportResult,
  FolderGlossaryInput,
  FolderGlossaryQueryResult,
} from "./folderGlossaryTypes";

export { syncFolderGlossary } from "./folderGlossarySyncApi";

const DEFAULT_IMPORT_CHUNK_SIZE = 180;
const MIN_IMPORT_CHUNK_SIZE = 20;

export interface FolderGlossaryImportProgress {
  processed: number;
  total: number;
}

export interface FolderGlossaryImportOptions {
  chunkSize?: number;
  onProgress?: (progress: FolderGlossaryImportProgress) => void;
}

function isStatementTimeout(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /statement timeout|canceling statement due to statement timeout|57014/iu.test(message);
}

function emptyImportResult(
  folderId: string,
  mode: "merge" | "replace",
  dryRun: boolean,
): FolderGlossaryImportResult {
  return {
    folder_id: folderId,
    mode,
    dry_run: dryRun,
    inserted: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
  };
}

function addImportResult(
  target: FolderGlossaryImportResult,
  source: FolderGlossaryImportResult,
): void {
  target.inserted += Number(source.inserted ?? 0);
  target.updated += Number(source.updated ?? 0);
  target.skipped += Number(source.skipped ?? 0);
  target.removed += Number(source.removed ?? 0);
}

async function importFolderGlossaryChunk(
  folderId: string,
  entries: FolderGlossaryInput[],
  mode: "merge" | "replace",
  dryRun: boolean,
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

async function loadFolderGlossaryRows(folderId: string): Promise<FolderGlossaryEntry[]> {
  return fetchAllSupabaseRows<FolderGlossaryEntry>((from, to) =>
    (supabase as any)
      .from("folder_glossary")
      .select("*")
      .eq("folder_id", folderId)
      .order("original_text", { ascending: true })
      .order("side", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function loadFolderGlossary(folderId: string): Promise<FolderGlossaryQueryResult> {
  const [entries, permission] = await Promise.all([
    loadFolderGlossaryRows(folderId),
    (supabase as any).rpc("can_manage_folder_glossary_v1", { _folder_id: folderId }),
  ]);

  if (permission.error) throw permission.error;
  const canEdit = permission.data === true;
  return {
    entries: entries.map((entry) => ({ ...entry, can_edit: canEdit })),
    canEdit,
  };
}

export async function loadFolderGlossaryForList(listId: string): Promise<AccountGlossaryEntry[]> {
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("folder_id")
    .eq("id", listId)
    .maybeSingle();
  if (listError) throw listError;
  if (!list?.folder_id) return [];

  const rows = (await loadFolderGlossaryRows(list.folder_id as string))
    .filter((entry) => entry.is_active);

  return rows.flatMap<AccountGlossaryEntry>((entry) => {
    const translations = [
      entry.primary_translation,
      ...(entry.alternative_translations ?? []),
    ].filter((value, index, values) => value && values.indexOf(value) === index);

    return translations.map((translatedText) => ({
      id: entry.id,
      owner_id: entry.owner_id,
      original_text: entry.original_text,
      translated_text: translatedText,
      note: entry.note,
      side: entry.side,
      is_active: entry.is_active,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    }));
  });
}

export async function importFolderGlossary(
  folderId: string,
  entries: FolderGlossaryInput[],
  mode: "merge" | "replace" = "merge",
  dryRun = false,
  options: FolderGlossaryImportOptions = {},
): Promise<FolderGlossaryImportResult> {
  const total = entries.length;
  const requestedChunkSize = Math.floor(options.chunkSize ?? DEFAULT_IMPORT_CHUNK_SIZE);
  const chunkSize = Math.max(MIN_IMPORT_CHUNK_SIZE, requestedChunkSize);

  // Dry-run must remain a single transaction so replace-mode counts stay accurate.
  if (dryRun || total <= chunkSize) {
    const result = await importFolderGlossaryChunk(folderId, entries, mode, dryRun);
    options.onProgress?.({ processed: total, total });
    return result;
  }

  const aggregate = emptyImportResult(folderId, mode, dryRun);
  let processed = 0;
  let replaceStillPending = mode === "replace";

  const runAdaptiveChunk = async (
    chunk: FolderGlossaryInput[],
    chunkMode: "merge" | "replace",
  ): Promise<void> => {
    try {
      const result = await importFolderGlossaryChunk(folderId, chunk, chunkMode, false);
      addImportResult(aggregate, result);
      processed += chunk.length;
      options.onProgress?.({ processed, total });
      return;
    } catch (error) {
      if (!isStatementTimeout(error) || chunk.length <= MIN_IMPORT_CHUNK_SIZE) {
        if (isStatementTimeout(error)) {
          throw new Error(
            `O banco ainda excedeu o tempo ao importar um lote de ${chunk.length} entradas. `
            + `Tente novamente; as entradas já concluídas podem ser mescladas sem duplicação.`,
          );
        }
        throw error;
      }

      const middle = Math.ceil(chunk.length / 2);
      const left = chunk.slice(0, middle);
      const right = chunk.slice(middle);

      await runAdaptiveChunk(left, chunkMode);
      if (right.length > 0) await runAdaptiveChunk(right, "merge");
    }
  };

  for (let offset = 0; offset < total; offset += chunkSize) {
    const chunk = entries.slice(offset, offset + chunkSize);
    const chunkMode: "merge" | "replace" = replaceStillPending ? "replace" : "merge";
    await runAdaptiveChunk(chunk, chunkMode);
    replaceStillPending = false;
  }

  return aggregate;
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
  const chunkSize = 250;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const { error } = await (supabase as any)
      .from("folder_glossary")
      .delete()
      .in("id", ids.slice(index, index + chunkSize));
    if (error) throw error;
  }
}
