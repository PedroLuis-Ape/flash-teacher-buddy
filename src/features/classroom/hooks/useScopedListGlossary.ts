import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListGlossary } from "@/hooks/useListGlossary";
import {
  CLASS_GLOSSARY_QUERY_KEY,
  clearPendingClassGlossaryContext,
  loadClassGlossaryForList,
  readPendingClassGlossaryContext,
} from "@/features/classroom/lib/classGlossary";
import { subscribeFolderGlossaryRefresh } from "@/features/study/lib/folderGlossaryRefresh";

const EMPTY_GLOSSARY: ReturnType<typeof useListGlossary>["activeGlossary"] = [];

export function useScopedListGlossary(
  listId?: string,
  explicitTurmaId?: string | null,
) {
  const queryClient = useQueryClient();
  const pendingTurmaId = useMemo(
    () => explicitTurmaId || readPendingClassGlossaryContext(),
    [explicitTurmaId, listId],
  );
  const useClassScope = Boolean(listId && pendingTurmaId);
  const folderGlossary = useListGlossary(useClassScope ? undefined : listId);

  const classQueryKey = useMemo(() => [
    ...CLASS_GLOSSARY_QUERY_KEY,
    "list",
    pendingTurmaId ?? "none",
    listId ?? "none",
  ] as const, [listId, pendingTurmaId]);

  const classQuery = useQuery({
    queryKey: classQueryKey,
    queryFn: () => loadClassGlossaryForList({
      turmaId: pendingTurmaId as string,
      listId: listId as string,
    }),
    enabled: useClassScope,
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!pendingTurmaId || !classQuery.data) return;
    if (classQuery.data.assigned) {
      clearPendingClassGlossaryContext(pendingTurmaId);
    } else if (!explicitTurmaId) {
      clearPendingClassGlossaryContext(pendingTurmaId);
    }
  }, [classQuery.data, explicitTurmaId, pendingTurmaId]);

  useEffect(() => subscribeFolderGlossaryRefresh((report) => {
    if (!classQuery.data?.storageFolderId || report.folderId !== classQuery.data.storageFolderId) return;
    void queryClient.invalidateQueries({
      queryKey: classQueryKey,
      exact: true,
      refetchType: "active",
    });
  }), [classQuery.data?.storageFolderId, classQueryKey, queryClient]);

  if (!useClassScope) return folderGlossary;

  return {
    ...folderGlossary,
    glossary: classQuery.data?.glossary ?? EMPTY_GLOSSARY,
    activeGlossary: classQuery.data?.glossary ?? EMPTY_GLOSSARY,
    folderId: classQuery.data?.storageFolderId ?? undefined,
    status: classQuery.isLoading
      ? "loading" as const
      : classQuery.isError
        ? "error" as const
        : (classQuery.data?.glossary.length ?? 0) > 0
          ? "ready" as const
          : "empty" as const,
    source: "class-glossary" as const,
    recoveredFrom: [],
    isLoading: classQuery.isLoading,
    isFetching: classQuery.isFetching,
    error: classQuery.error,
    refetch: classQuery.refetch,
  };
}
