import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import type { AccountGlossaryEntry } from "./accountGlossaryTypes";
import {
  cleanFolderGlossaryText,
  compactFolderGlossaryEntries,
  folderGlossaryIdentity,
} from "./folderGlossaryCompact";
import type {
  FolderGlossaryEntry,
  FolderGlossaryImportResult,
  FolderGlossaryInput,
  FolderGlossaryPageParams,
  FolderGlossaryPageResult,
  FolderGlossaryQueryResult,
  FolderGlossarySummary,
} from "./folderGlossaryTypes";

export {
  syncFolderGlossary,
  readFolderGlossarySyncStatus,
  folderGlossarySyncStorageKey,
} from "./folderGlossarySyncApi";
export type { FolderGlossarySyncStatus } from "./folderGlossarySyncApi";

const DEFAULT_IMPORT_CHUNK_SIZE = 1_000;
const MIN_IMPORT_CHUNK_SIZE = 20;
const DEFAULT_PAGE_SIZE = 60;
const MAX_PAGE_SIZE = 200;

export interface FolderGlossaryImportProgress {
  processed: number;
  total: number;
}

export interface FolderGlossaryImportOptions {
  chunkSize?: number;
  onProgress?: (progress: FolderGlossaryImportProgress) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
}

function isStatementTimeout(error: unknown): boolean {
  return /statement timeout|canceling statement due to statement timeout|57014/iu.test(
    errorMessage(error),
  );
}

function isMissingRpc(error: unknown, functionName: string): boolean {
  const message = errorMessage(error);
  return /PGRST202|could not find the function|schema cache/iu.test(message)
    && message.toLocaleLowerCase().includes(functionName.toLocaleLowerCase());
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
    received: 0,
    compacted: 0,
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
  target.received = Number(target.received ?? 0) + Number(source.received ?? 0);
  target.compacted = Number(target.compacted ?? 0) + Number(source.compacted ?? 0);
}

async function importFolderGlossaryChunk(
  folderId: string,
  entries: FolderGlossaryInput[],
  mode: "merge" | "replace",
  dryRun: boolean,
): Promise<FolderGlossaryImportResult> {
  const parameters = {
    _folder_id: folderId,
    _entries: entries,
    _mode: mode,
    _dry_run: dryRun,
  };
  const v2 = await (supabase as any).rpc("import_folder_glossary_v2", parameters);

  if (!v2.error) return v2.data as FolderGlossaryImportResult;
  if (!isMissingRpc(v2.error, "import_folder_glossary_v2")) throw v2.error;

  const v1 = await (supabase as any).rpc("import_folder_glossary_v1", parameters);
  if (v1.error) throw v1.error;
  return v1.data as FolderGlossaryImportResult;
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

export async function loadFolderGlossarySummary(folderId: string): Promise<FolderGlossarySummary> {
  const response = await (supabase as any).rpc("get_folder_glossary_summary_v2", {
    _folder_id: folderId,
  });

  if (!response.error) {
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    return {
      total: Number(row?.total_count ?? 0),
      active: Number(row?.active_count ?? 0),
      canEdit: row?.can_edit === true,
    };
  }

  if (!isMissingRpc(response.error, "get_folder_glossary_summary_v2")) throw response.error;
  const fallback = await loadFolderGlossary(folderId);
  return {
    total: fallback.entries.length,
    active: fallback.entries.filter((entry) => entry.is_active).length,
    canEdit: fallback.canEdit,
  };
}

export async function loadFolderGlossaryPage(
  folderId: string,
  params: FolderGlossaryPageParams = {},
): Promise<FolderGlossaryPageResult> {
  const page = Math.max(0, Math.floor(params.page ?? 0));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const search = cleanFolderGlossaryText(params.search) || null;
  const side = params.side === "A" || params.side === "B" ? params.side : null;
  const offset = page * pageSize;

  const response = await (supabase as any).rpc("search_folder_glossary_page_v2", {
    _folder_id: folderId,
    _search: search,
    _side: side,
    _limit: pageSize,
    _offset: offset,
  });

  if (!response.error) {
    const payload = response.data as {
      entries?: FolderGlossaryEntry[];
      total?: number;
      can_edit?: boolean;
      limit?: number;
      offset?: number;
    } | null;
    return {
      entries: Array.isArray(payload?.entries) ? payload.entries : [],
      total: Number(payload?.total ?? 0),
      page,
      pageSize: Number(payload?.limit ?? pageSize),
      canEdit: payload?.can_edit === true,
    };
  }

  if (!isMissingRpc(response.error, "search_folder_glossary_page_v2")) throw response.error;

  const fallback = await loadFolderGlossary(folderId);
  const searchIdentity = folderGlossaryIdentity(search);
  const filtered = fallback.entries.filter((entry) => {
    if (side && entry.side !== side) return false;
    if (!searchIdentity) return true;
    return [
      entry.original_text,
      entry.primary_translation,
      ...entry.alternative_translations,
      entry.note ?? "",
    ].some((value) => folderGlossaryIdentity(value).includes(searchIdentity));
  });

  return {
    entries: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize,
    canEdit: fallback.canEdit,
  };
}

export async function loadFolderGlossaryForList(listId: string): Promise<AccountGlossaryEntry[]> {
  const v2 = await (supabase as any).rpc("get_folder_glossary_for_list_v2", {
    _list_id: listId,
  });
  if (!v2.error) return (v2.data ?? []) as AccountGlossaryEntry[];
  if (!isMissingRpc(v2.error, "get_folder_glossary_for_list_v2")) throw v2.error;

  const v1 = await (supabase as any).rpc("get_folder_glossary_for_list_v1", {
    _list_id: listId,
  });
  if (!v1.error) return (v1.data ?? []) as AccountGlossaryEntry[];
  if (!isMissingRpc(v1.error, "get_folder_glossary_for_list_v1")) throw v1.error;

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("folder_id")
    .eq("id", listId)
    .maybeSingle();
  if (listError) throw listError;
  if (!list?.folder_id) return [];

  const rows = (await loadFolderGlossaryRows(list.folder_id as string))
    .filter((entry) => entry.is_active);

  return rows.map<AccountGlossaryEntry>((entry) => ({
    id: entry.id,
    owner_id: entry.owner_id,
    original_text: entry.original_text,
    translated_text: [entry.primary_translation, ...(entry.alternative_translations ?? [])]
      .filter(Boolean)
      .join(", "),
    note: entry.note,
    side: entry.side,
    is_active: entry.is_active,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }));
}

export async function importFolderGlossary(
  folderId: string,
  entries: FolderGlossaryInput[],
  mode: "merge" | "replace" = "merge",
  dryRun = false,
  options: FolderGlossaryImportOptions = {},
): Promise<FolderGlossaryImportResult> {
  const received = entries.length;
  const compactedEntries = compactFolderGlossaryEntries(entries);
  const preSkipped = Math.max(0, received - compactedEntries.length);
  const total = compactedEntries.length;
  const requestedChunkSize = Math.floor(options.chunkSize ?? DEFAULT_IMPORT_CHUNK_SIZE);
  const chunkSize = Math.max(MIN_IMPORT_CHUNK_SIZE, requestedChunkSize);

  if (total === 0) {
    const empty = emptyImportResult(folderId, mode, dryRun);
    empty.skipped = received;
    empty.received = received;
    empty.compacted = 0;
    options.onProgress?.({ processed: received, total: received });
    return empty;
  }

  // Dry-run permanece em uma única transação para manter contagens corretas no modo replace.
  if (dryRun || total <= chunkSize) {
    const result = await importFolderGlossaryChunk(folderId, compactedEntries, mode, dryRun);
    result.skipped = Number(result.skipped ?? 0) + preSkipped;
    result.received = received;
    result.compacted = total;
    options.onProgress?.({ processed: received, total: received });
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
      options.onProgress?.({
        processed: Math.min(received, processed + preSkipped),
        total: received,
      });
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
    const chunk = compactedEntries.slice(offset, offset + chunkSize);
    const chunkMode: "merge" | "replace" = replaceStillPending ? "replace" : "merge";
    await runAdaptiveChunk(chunk, chunkMode);
    replaceStillPending = false;
  }

  aggregate.skipped += preSkipped;
  aggregate.received = received;
  aggregate.compacted = total;
  return aggregate;
}

export async function addFolderGlossaryEntry(
  folderId: string,
  entry: FolderGlossaryInput,
): Promise<void> {
  const compacted = compactFolderGlossaryEntries([entry])[0];
  if (!compacted) throw new Error("Informe um termo e uma tradução válidos.");

  const { error } = await (supabase as any).from("folder_glossary").insert({
    folder_id: folderId,
    original_text: compacted.term,
    primary_translation: compacted.translation,
    alternative_translations: compacted.alternatives ?? [],
    note: compacted.note ?? null,
    side: compacted.side ?? "A",
    source_language: compacted.source_language ?? null,
    target_language: compacted.target_language ?? null,
    is_active: compacted.active ?? true,
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
