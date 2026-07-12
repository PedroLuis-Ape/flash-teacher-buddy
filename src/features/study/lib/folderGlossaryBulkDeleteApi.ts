import { supabase } from "@/integrations/supabase/client";
import { loadFolderGlossaryPage } from "./folderGlossaryApi";
import type { GlossarySide } from "./folderGlossaryTypes";

export type FolderGlossaryBulkDeleteRequest =
  | { scope: "ids"; ids: string[] }
  | { scope: "filter"; search?: string; side?: GlossarySide | null }
  | { scope: "all" };

export interface FolderGlossaryBulkDeleteResult {
  deleted: number;
  scope: FolderGlossaryBulkDeleteRequest["scope"];
}

const DIRECT_DELETE_CHUNK_SIZE = 250;
const FILTER_DELETE_PAGE_SIZE = 200;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function isMissingBulkDeleteRpc(error: unknown): boolean {
  const message = errorMessage(error);
  return /PGRST202|could not find the function|schema cache/iu.test(message)
    && message.toLocaleLowerCase().includes("delete_folder_glossary_bulk_v1");
}

async function deleteIdsDirect(folderId: string, ids: string[]): Promise<number> {
  let deleted = 0;

  for (let index = 0; index < ids.length; index += DIRECT_DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DIRECT_DELETE_CHUNK_SIZE);
    const { count, error } = await (supabase as any)
      .from("folder_glossary")
      .delete({ count: "exact" })
      .eq("folder_id", folderId)
      .in("id", chunk);

    if (error) throw error;
    const affected = count == null ? chunk.length : Number(count);
    if (affected === 0 && chunk.length > 0) {
      throw new Error("Nenhuma entrada foi apagada. Verifique sua permissão para editar esta pasta.");
    }
    deleted += affected;
  }

  return deleted;
}

async function deleteAllDirect(folderId: string): Promise<number> {
  const before = await loadFolderGlossaryPage(folderId, { page: 0, pageSize: 1 });
  const { count, error } = await (supabase as any)
    .from("folder_glossary")
    .delete({ count: "exact" })
    .eq("folder_id", folderId);

  if (error) throw error;
  return count == null ? before.total : Number(count);
}

async function deleteFilteredDirect(
  folderId: string,
  request: Extract<FolderGlossaryBulkDeleteRequest, { scope: "filter" }>,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const page = await loadFolderGlossaryPage(folderId, {
      page: 0,
      pageSize: FILTER_DELETE_PAGE_SIZE,
      search: request.search?.trim() || undefined,
      side: request.side ?? "all",
    });
    const ids = page.entries.map((entry) => entry.id);
    if (ids.length === 0) break;

    deleted += await deleteIdsDirect(folderId, ids);
    if (page.total <= ids.length) break;
  }

  return deleted;
}

async function deleteWithoutRpc(
  folderId: string,
  request: FolderGlossaryBulkDeleteRequest,
): Promise<FolderGlossaryBulkDeleteResult> {
  const deleted = request.scope === "ids"
    ? await deleteIdsDirect(folderId, request.ids)
    : request.scope === "filter"
      ? await deleteFilteredDirect(folderId, request)
      : await deleteAllDirect(folderId);

  return { deleted, scope: request.scope };
}

export async function deleteFolderGlossaryBulk(
  folderId: string,
  request: FolderGlossaryBulkDeleteRequest,
): Promise<FolderGlossaryBulkDeleteResult> {
  if (!folderId) throw new Error("Abra uma pasta válida para apagar o glossário.");
  if (request.scope === "ids" && request.ids.length === 0) {
    throw new Error("Selecione pelo menos uma entrada.");
  }
  if (
    request.scope === "filter"
    && !request.search?.trim()
    && request.side !== "A"
    && request.side !== "B"
  ) {
    throw new Error("Use uma busca ou um filtro de lado antes de apagar resultados.");
  }

  const { data, error } = await (supabase as any).rpc("delete_folder_glossary_bulk_v1", {
    _folder_id: folderId,
    _scope: request.scope,
    _ids: request.scope === "ids" ? request.ids : null,
    _search: request.scope === "filter" ? request.search?.trim() || null : null,
    _side: request.scope === "filter" ? request.side ?? null : null,
  });

  if (!error) {
    return {
      deleted: Number(data?.deleted ?? 0),
      scope: request.scope,
    };
  }

  if (!isMissingBulkDeleteRpc(error)) throw error;

  console.warn(
    "[FolderGlossary] RPC de exclusão em massa indisponível; usando exclusão direta protegida por RLS.",
  );
  return deleteWithoutRpc(folderId, request);
}
