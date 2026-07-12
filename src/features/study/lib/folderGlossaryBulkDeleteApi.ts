import { supabase } from "@/integrations/supabase/client";
import type { GlossarySide } from "./folderGlossaryTypes";

export type FolderGlossaryBulkDeleteRequest =
  | { scope: "ids"; ids: string[] }
  | { scope: "filter"; search?: string; side?: GlossarySide | null }
  | { scope: "all" };

export interface FolderGlossaryBulkDeleteResult {
  deleted: number;
  scope: FolderGlossaryBulkDeleteRequest["scope"];
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

  if (error) throw error;
  return {
    deleted: Number(data?.deleted ?? 0),
    scope: request.scope,
  };
}
