import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addFolderGlossaryEntry,
  deleteFolderGlossaryEntries,
  importFolderGlossary,
  loadFolderGlossary,
  updateFolderGlossaryEntry,
  type FolderGlossaryImportProgress,
} from "@/features/study/lib/folderGlossaryApi";
import {
  publishFolderGlossaryRefresh,
  subscribeFolderGlossaryRefresh,
  type FolderGlossaryRefreshSource,
} from "@/features/study/lib/folderGlossaryRefresh";
import type {
  FolderGlossaryEntry,
  FolderGlossaryInput,
} from "@/features/study/lib/folderGlossaryTypes";

export const FOLDER_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;

export function useFolderGlossary(folderId?: string) {
  const queryClient = useQueryClient();
  const queryKey = [...FOLDER_GLOSSARY_QUERY_KEY, folderId ?? "none"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLDER_GLOSSARY_QUERY_KEY });
  const announceRefresh = (source: FolderGlossaryRefreshSource) => {
    if (!folderId) return;
    publishFolderGlossaryRefresh({
      folderId,
      syncedAt: new Date().toISOString(),
      source,
    });
  };

  useEffect(() => subscribeFolderGlossaryRefresh((report) => {
    if (!folderId || report.folderId !== folderId) return;
    void queryClient.invalidateQueries({
      queryKey: FOLDER_GLOSSARY_QUERY_KEY,
      refetchType: "active",
    });
  }), [folderId, queryClient]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadFolderGlossary(folderId as string),
    enabled: Boolean(folderId),
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  const addEntry = useMutation({
    mutationFn: (entry: FolderGlossaryInput) => addFolderGlossaryEntry(folderId as string, entry),
    onSuccess: () => {
      void invalidate();
      announceRefresh("edit");
      toast.success("Entrada adicionada ao glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, ...fields }: Partial<FolderGlossaryEntry> & { id: string }) =>
      updateFolderGlossaryEntry(id, fields),
    onSuccess: () => {
      void invalidate();
      announceRefresh("edit");
      toast.success("Entrada atualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => deleteFolderGlossaryEntries([id]),
    onSuccess: () => {
      void invalidate();
      announceRefresh("edit");
      toast.success("Entrada removida.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importEntries = useMutation({
    mutationFn: ({
      entries,
      mode,
      onProgress,
    }: {
      entries: FolderGlossaryInput[];
      mode: "merge" | "replace";
      onProgress?: (progress: FolderGlossaryImportProgress) => void;
    }) => importFolderGlossary(folderId as string, entries, mode, false, { onProgress }),
    onSuccess: (result) => {
      void invalidate();
      announceRefresh("import");
      toast.success(
        `Glossário atualizado: ${result.inserted} nova(s), ${result.updated} alterada(s), ${result.skipped} ignorada(s).`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    entries: query.data?.entries ?? [],
    activeEntries: (query.data?.entries ?? []).filter((entry) => entry.is_active),
    canEdit: query.data?.canEdit ?? false,
    isLoading: query.isLoading,
    error: query.error,
    addEntry,
    updateEntry,
    deleteEntry,
    importEntries,
  };
}
