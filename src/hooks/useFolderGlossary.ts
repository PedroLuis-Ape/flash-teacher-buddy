import { useEffect, useMemo } from "react";
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
const EMPTY_ENTRIES: FolderGlossaryEntry[] = [];

export function useFolderGlossary(folderId?: string) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => [...FOLDER_GLOSSARY_QUERY_KEY, folderId ?? "none"] as const,
    [folderId],
  );
  const invalidate = () => queryClient.invalidateQueries({ queryKey, exact: true });
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
      queryKey,
      exact: true,
      refetchType: "active",
    });
  }), [folderId, queryClient, queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadFolderGlossary(folderId as string),
    enabled: Boolean(folderId),
    staleTime: 60_000,
  });

  const entries = query.data?.entries ?? EMPTY_ENTRIES;
  const activeEntries = useMemo(
    () => entries.filter((entry) => entry.is_active),
    [entries],
  );

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
      entries: importedEntries,
      mode,
      onProgress,
    }: {
      entries: FolderGlossaryInput[];
      mode: "merge" | "replace";
      onProgress?: (progress: FolderGlossaryImportProgress) => void;
    }) => importFolderGlossary(folderId as string, importedEntries, mode, false, { onProgress }),
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
    entries,
    activeEntries,
    canEdit: query.data?.canEdit ?? false,
    isLoading: query.isLoading,
    error: query.error,
    addEntry,
    updateEntry,
    deleteEntry,
    importEntries,
  };
}
