import { useCallback, useEffect, useMemo } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addFolderGlossaryEntry,
  deleteFolderGlossaryEntries,
  importFolderGlossary,
  loadFolderGlossary,
  loadFolderGlossaryPage,
  loadFolderGlossarySummary,
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
  FolderGlossaryPageParams,
} from "@/features/study/lib/folderGlossaryTypes";

export const FOLDER_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;
const EMPTY_ENTRIES: FolderGlossaryEntry[] = [];

const fullQueryKey = (folderId?: string) => [
  ...FOLDER_GLOSSARY_QUERY_KEY,
  folderId ?? "none",
] as const;

const summaryQueryKey = (folderId?: string) => [
  ...FOLDER_GLOSSARY_QUERY_KEY,
  "summary",
  folderId ?? "none",
] as const;

const pageQueryPrefix = (folderId?: string) => [
  ...FOLDER_GLOSSARY_QUERY_KEY,
  "page",
  folderId ?? "none",
] as const;

async function invalidateFolderGlossaryQueries(
  queryClient: QueryClient,
  folderId?: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: fullQueryKey(folderId), exact: true }),
    queryClient.invalidateQueries({ queryKey: summaryQueryKey(folderId), exact: true }),
    queryClient.invalidateQueries({ queryKey: pageQueryPrefix(folderId), exact: false }),
  ]);
}

function useFolderGlossaryRefresh(folderId?: string) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    () => invalidateFolderGlossaryQueries(queryClient, folderId),
    [folderId, queryClient],
  );

  const announceRefresh = useCallback((source: FolderGlossaryRefreshSource) => {
    if (!folderId) return;
    publishFolderGlossaryRefresh({
      folderId,
      syncedAt: new Date().toISOString(),
      source,
    });
  }, [folderId]);

  useEffect(() => subscribeFolderGlossaryRefresh((report) => {
    if (!folderId || report.folderId !== folderId) return;
    void invalidate();
  }), [folderId, invalidate]);

  return { invalidate, announceRefresh };
}

export function useFolderGlossaryActions(folderId?: string) {
  const { invalidate, announceRefresh } = useFolderGlossaryRefresh(folderId);

  const requireFolder = () => {
    if (!folderId) throw new Error("Abra uma pasta válida para editar o glossário.");
    return folderId;
  };

  const addEntry = useMutation({
    mutationFn: (entry: FolderGlossaryInput) => addFolderGlossaryEntry(requireFolder(), entry),
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
    }) => importFolderGlossary(requireFolder(), importedEntries, mode, false, { onProgress }),
    onSuccess: (result) => {
      void invalidate();
      announceRefresh("import");
      const compactedText = result.received !== undefined && result.compacted !== undefined
        && result.received !== result.compacted
        ? ` ${result.received - result.compacted} repetida(s) foi(ram) agrupada(s).`
        : "";
      toast.success(
        `Glossário atualizado: ${result.inserted} nova(s), ${result.updated} alterada(s), ${result.skipped} ignorada(s).${compactedText}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    addEntry,
    updateEntry,
    deleteEntry,
    importEntries,
    invalidate,
  };
}

export function useFolderGlossarySummary(folderId?: string) {
  useFolderGlossaryRefresh(folderId);
  const queryKey = useMemo(() => summaryQueryKey(folderId), [folderId]);
  const query = useQuery({
    queryKey,
    queryFn: () => loadFolderGlossarySummary(folderId as string),
    enabled: Boolean(folderId),
    staleTime: 60_000,
  });

  return {
    total: query.data?.total ?? 0,
    active: query.data?.active ?? 0,
    canEdit: query.data?.canEdit ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

export function useFolderGlossaryPage(
  folderId?: string,
  params: FolderGlossaryPageParams = {},
) {
  const page = Math.max(0, Math.floor(params.page ?? 0));
  const pageSize = Math.max(1, Math.floor(params.pageSize ?? 60));
  const search = params.search?.trim() ?? "";
  const side = params.side ?? "all";
  const queryKey = useMemo(() => [
    ...pageQueryPrefix(folderId),
    page,
    pageSize,
    search,
    side,
  ] as const, [folderId, page, pageSize, search, side]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadFolderGlossaryPage(folderId as string, {
      page,
      pageSize,
      search,
      side,
    }),
    enabled: Boolean(folderId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const actions = useFolderGlossaryActions(folderId);

  return {
    entries: query.data?.entries ?? EMPTY_ENTRIES,
    total: query.data?.total ?? 0,
    canEdit: query.data?.canEdit ?? false,
    page: query.data?.page ?? page,
    pageSize: query.data?.pageSize ?? pageSize,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    ...actions,
  };
}

/**
 * Carregamento completo mantido para auditoria e exportação explícitas.
 * A interface comum deve preferir useFolderGlossarySummary/useFolderGlossaryPage.
 */
export function useFolderGlossary(folderId?: string) {
  const queryKey = useMemo(() => fullQueryKey(folderId), [folderId]);
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
  const actions = useFolderGlossaryActions(folderId);

  return {
    entries,
    activeEntries,
    canEdit: query.data?.canEdit ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    ...actions,
  };
}
