import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addFolderGlossaryEntry,
  deleteFolderGlossaryEntries,
  importFolderGlossary,
  loadFolderGlossary,
  updateFolderGlossaryEntry,
} from "@/features/study/lib/folderGlossaryApi";
import type {
  FolderGlossaryEntry,
  FolderGlossaryInput,
} from "@/features/study/lib/folderGlossaryTypes";

export const FOLDER_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;

export function useFolderGlossary(folderId?: string) {
  const queryClient = useQueryClient();
  const queryKey = [...FOLDER_GLOSSARY_QUERY_KEY, folderId ?? "none"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLDER_GLOSSARY_QUERY_KEY });

  const query = useQuery({
    queryKey,
    queryFn: () => loadFolderGlossary(folderId as string),
    enabled: Boolean(folderId),
    staleTime: 60_000,
  });

  const addEntry = useMutation({
    mutationFn: (entry: FolderGlossaryInput) => addFolderGlossaryEntry(folderId as string, entry),
    onSuccess: () => {
      void invalidate();
      toast.success("Entrada adicionada ao glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, ...fields }: Partial<FolderGlossaryEntry> & { id: string }) =>
      updateFolderGlossaryEntry(id, fields),
    onSuccess: () => {
      void invalidate();
      toast.success("Entrada atualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => deleteFolderGlossaryEntries([id]),
    onSuccess: () => {
      void invalidate();
      toast.success("Entrada removida.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importEntries = useMutation({
    mutationFn: ({
      entries,
      mode,
    }: {
      entries: FolderGlossaryInput[];
      mode: "merge" | "replace";
    }) => importFolderGlossary(folderId as string, entries, mode, false),
    onSuccess: (result) => {
      void invalidate();
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
