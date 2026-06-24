import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";
import type { AccountGlossaryEntry } from "@/features/study/lib/accountGlossaryTypes";
import {
  addFolderGlossaryEntry,
  deleteFolderGlossaryEntries,
  importFolderGlossary,
  loadFolderGlossaryForList,
  updateFolderGlossaryEntry,
} from "@/features/study/lib/folderGlossaryApi";
import {
  publishFolderGlossaryRefresh,
  subscribeFolderGlossaryRefresh,
} from "@/features/study/lib/folderGlossaryRefresh";

export interface GlossaryEntry extends AccountGlossaryEntry {
  list_id?: string;
}

export type GlossaryInsert = Pick<GlossaryEntry, "original_text" | "translated_text" | "side"> & {
  list_id?: string;
  note?: string;
  is_active?: boolean;
};

export interface GlossaryImportResult {
  inserted: number;
  updated: number;
  skipped: number;
}

export const FOLDER_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;
export const ACCOUNT_GLOSSARY_QUERY_KEY = FOLDER_GLOSSARY_QUERY_KEY;

async function loadListGlossaryContext(listId: string) {
  const [{ data: list, error: listError }, glossary] = await Promise.all([
    supabase.from("lists").select("folder_id").eq("id", listId).maybeSingle(),
    loadFolderGlossaryForList(listId),
  ]);
  if (listError) throw listError;
  if (!list?.folder_id) throw new Error("A lista não pertence a uma pasta válida.");
  return { folderId: list.folder_id as string, glossary: glossary as GlossaryEntry[] };
}

export function useListGlossary(listId?: string) {
  const queryClient = useQueryClient();
  const queryKey = [...FOLDER_GLOSSARY_QUERY_KEY, "list", listId ?? "none"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLDER_GLOSSARY_QUERY_KEY });

  const query = useQuery({
    queryKey,
    queryFn: () => loadListGlossaryContext(listId as string),
    enabled: Boolean(listId),
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  const folderId = query.data?.folderId;
  const glossary = query.data?.glossary ?? [];

  useEffect(() => subscribeFolderGlossaryRefresh((report) => {
    if (!folderId || report.folderId !== folderId) return;
    void queryClient.invalidateQueries({
      queryKey: FOLDER_GLOSSARY_QUERY_KEY,
      refetchType: "active",
    });
  }), [folderId, queryClient]);

  const requireFolder = () => {
    if (!folderId) throw new Error("Abra uma lista vinculada a uma pasta para editar o glossário.");
    return folderId;
  };

  const announceEdit = () => {
    if (!folderId) return;
    publishFolderGlossaryRefresh({
      folderId,
      syncedAt: new Date().toISOString(),
      source: "edit",
    });
  };

  const addEntry = useMutation({
    mutationFn: async ({ list_id: _listId, ...entry }: GlossaryInsert) => {
      await addFolderGlossaryEntry(requireFolder(), {
        term: entry.original_text,
        translation: entry.translated_text,
        side: entry.side,
        note: entry.note ?? null,
        active: entry.is_active ?? true,
      });
    },
    onSuccess: () => {
      void invalidate();
      announceEdit();
      toast.success("Entrada adicionada ao glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, translated_text, ...fields }: Partial<GlossaryEntry> & { id: string }) => {
      await updateFolderGlossaryEntry(id, {
        original_text: fields.original_text,
        primary_translation: translated_text,
        note: fields.note,
        side: fields.side,
        is_active: fields.is_active,
      });
    },
    onSuccess: () => {
      void invalidate();
      announceEdit();
      toast.success("Entrada atualizada no glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => deleteFolderGlossaryEntries([id]),
    onSuccess: () => {
      void invalidate();
      announceEdit();
      toast.success("Entrada removida do glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateFolderGlossaryEntry(id, { is_active }),
    onSuccess: () => {
      void invalidate();
      announceEdit();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkDelete = useMutation({
    mutationFn: deleteFolderGlossaryEntries,
    onSuccess: () => {
      void invalidate();
      announceEdit();
      toast.success("Entradas removidas do glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkSwapTerms = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const entry of glossary.filter((item) => ids.includes(item.id))) {
        await updateFolderGlossaryEntry(entry.id, {
          original_text: entry.translated_text,
          primary_translation: entry.original_text,
          side: entry.side === "A" ? "B" : "A",
        });
      }
    },
    onSuccess: () => {
      void invalidate();
      announceEdit();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importEntries = useMutation({
    mutationFn: async (entries: GlossaryTransferEntry[]): Promise<GlossaryImportResult> => {
      const currentFolderId = requireFolder();
      const result = await importFolderGlossary(
        currentFolderId,
        entries.map((entry) => ({
          term: entry.original_text,
          translation: entry.translated_text,
          note: entry.note ?? null,
          side: entry.side,
          active: entry.is_active ?? true,
        })),
        "merge",
        false,
      );
      return {
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
      };
    },
    onSuccess: (result) => {
      void invalidate();
      if (folderId) {
        publishFolderGlossaryRefresh({
          folderId,
          syncedAt: new Date().toISOString(),
          source: "import",
        });
      }
      toast.success(`Glossário da pasta: ${result.inserted} nova(s), ${result.updated} alterada(s).`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    glossary,
    activeGlossary: glossary.filter((entry) => entry.is_active),
    isLoading: query.isLoading,
    error: query.error,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleActive,
    bulkDelete,
    bulkSwapTerms,
    importEntries,
  };
}
