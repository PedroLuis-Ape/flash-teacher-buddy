import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";
import type { FolderGlossaryEntry, FolderGlossaryImportMode, FolderGlossaryImportResult } from "@/features/study/lib/folderGlossaryTypes";
import {
  addFolderGlossaryEntry,
  deleteFolderGlossaryEntries,
  importFolderGlossary,
  loadFolderGlossary,
  loadFolderGlossaryForList,
  resolveFolderIdForList,
  updateFolderGlossaryEntry,
} from "@/features/study/lib/folderGlossaryApi";

export interface GlossaryEntry extends FolderGlossaryEntry {
  list_id?: string;
}

export type GlossaryInsert = Pick<GlossaryEntry, "original_text" | "translated_text" | "side"> & {
  folder_id?: string;
  list_id?: string;
  note?: string;
  is_active?: boolean;
};

export type { FolderGlossaryImportResult as GlossaryImportResult };
export const FOLDER_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;

export function useFolderGlossary(folderId?: string, listId?: string) {
  const queryClient = useQueryClient();
  const queryKey = [...FOLDER_GLOSSARY_QUERY_KEY, folderId ?? "list", listId ?? "none"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLDER_GLOSSARY_QUERY_KEY });

  const { data: resolvedFolderId = folderId ?? null } = useQuery({
    queryKey: ["folder-id-for-list", listId],
    queryFn: () => listId ? resolveFolderIdForList(listId) : Promise.resolve(folderId ?? null),
    enabled: Boolean(listId) && !folderId,
    staleTime: 10 * 60_000,
  });

  const glossaryQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (folderId) return loadFolderGlossary(folderId, true);
      if (listId) return loadFolderGlossaryForList(listId);
      return Promise.resolve([]);
    },
    enabled: Boolean(folderId || listId),
    staleTime: 5 * 60_000,
    gcTime: 20 * 60_000,
  });

  const glossary = glossaryQuery.data ?? [];

  const addEntry = useMutation({
    mutationFn: async ({ folder_id: explicitFolderId, list_id: _listId, ...entry }: GlossaryInsert) => {
      const targetFolderId = explicitFolderId ?? resolvedFolderId;
      if (!targetFolderId) throw new Error("Abra uma pasta antes de editar o glossário.");
      await addFolderGlossaryEntry(targetFolderId, { ...entry, note: entry.note ?? null, is_active: entry.is_active ?? true });
    },
    onSuccess: () => { void invalidate(); toast.success("Entrada adicionada ao glossário da pasta."); },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, owner_id: _ownerId, folder_id: _folderId, list_id: _listId, class_id: _classId, created_at: _createdAt, updated_at: _updatedAt, ...fields }: Partial<GlossaryEntry> & { id: string }) => {
      await updateFolderGlossaryEntry(id, fields);
    },
    onSuccess: () => { void invalidate(); toast.success("Entrada atualizada no glossário da pasta."); },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => deleteFolderGlossaryEntries([id]),
    onSuccess: () => { void invalidate(); toast.success("Entrada removida do glossário da pasta."); },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => updateFolderGlossaryEntry(id, { is_active }),
    onSuccess: () => void invalidate(),
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const bulkDelete = useMutation({
    mutationFn: deleteFolderGlossaryEntries,
    onSuccess: (_data, ids) => { void invalidate(); toast.success(`${ids.length} entrada(s) removida(s) do glossário da pasta.`); },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const bulkSwapTerms = useMutation({
    mutationFn: async (ids: string[]) => {
      const selected = glossary.filter((entry) => ids.includes(entry.id));
      for (const entry of selected) {
        await updateFolderGlossaryEntry(entry.id, {
          original_text: entry.translated_text,
          translated_text: entry.original_text,
          side: entry.side === "A" ? "B" : "A",
        });
      }
    },
    onSuccess: (_data, ids) => { void invalidate(); toast.success(`${ids.length} termo(s) invertido(s) no glossário da pasta.`); },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const importEntries = useMutation({
    mutationFn: async (payload: GlossaryTransferEntry[] | { entries: GlossaryTransferEntry[]; mode?: FolderGlossaryImportMode }): Promise<FolderGlossaryImportResult> => {
      const targetFolderId = resolvedFolderId;
      if (!targetFolderId) throw new Error("Abra uma pasta antes de importar glossário.");
      const entries = Array.isArray(payload) ? payload : payload.entries;
      const mode = Array.isArray(payload) ? "merge" : payload.mode ?? "merge";
      return importFolderGlossary(targetFolderId, entries, mode, false);
    },
    onSuccess: (result) => { void invalidate(); toast.success(`Glossário da pasta: ${result.inserted} nova(s), ${result.updated} atualizada(s), ${result.skipped} ignorada(s).`); },
    onError: (mutationError: any) => toast.error("Erro ao importar glossário: " + mutationError.message),
  });

  return { ...glossaryQuery, data: glossary, glossary, activeGlossary: glossary.filter((entry) => entry.is_active), folderId: resolvedFolderId, addEntry, updateEntry, deleteEntry, toggleActive, bulkDelete, bulkSwapTerms, importEntries };
}
