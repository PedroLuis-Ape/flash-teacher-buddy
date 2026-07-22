import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";
import type { AccountGlossaryEntry } from "@/features/study/lib/accountGlossaryTypes";
import {
  addFolderGlossaryEntry,
  deleteFolderGlossaryEntries,
  importFolderGlossary,
  updateFolderGlossaryEntry,
} from "@/features/study/lib/folderGlossaryApi";
import {
  loadListGlossaryRuntime,
  type ListGlossaryRuntimeSource,
} from "@/features/study/lib/listGlossaryRuntime";
import {
  publishFolderGlossaryRefresh,
  subscribeFolderGlossaryRefresh,
} from "@/features/study/lib/folderGlossaryRefresh";
import {
  clearPendingClassGlossaryContext,
  loadClassGlossaryForList,
  readPendingClassGlossaryContext,
} from "@/features/classroom/lib/classGlossary";

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

export type ListGlossaryStatus = "idle" | "loading" | "ready" | "empty" | "error";
export type ScopedGlossaryRuntimeSource = ListGlossaryRuntimeSource | "class-glossary";

export const FOLDER_GLOSSARY_QUERY_KEY = ["folder-glossary"] as const;
export const ACCOUNT_GLOSSARY_QUERY_KEY = FOLDER_GLOSSARY_QUERY_KEY;

const EMPTY_GLOSSARY: GlossaryEntry[] = [];

function explicitTurmaIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("guest") === "true") return null;
  return params.get("turma");
}

async function loadListGlossaryContext(input: {
  listId: string;
  turmaId: string | null;
  turmaIsExplicit: boolean;
}) {
  if (input.turmaId) {
    const classResult = await loadClassGlossaryForList({
      turmaId: input.turmaId,
      listId: input.listId,
    });
    if (classResult.assigned) {
      clearPendingClassGlossaryContext(input.turmaId);
      return {
        folderId: classResult.storageFolderId ?? undefined,
        glossary: classResult.glossary,
        source: "class-glossary" as const,
        recoveredFrom: [],
      };
    }

    clearPendingClassGlossaryContext(input.turmaId);
    if (input.turmaIsExplicit) {
      return {
        folderId: undefined,
        glossary: EMPTY_GLOSSARY,
        source: "class-glossary" as const,
        recoveredFrom: [],
      };
    }
  }

  return loadListGlossaryRuntime(input.listId);
}

export function useListGlossary(listId?: string) {
  const queryClient = useQueryClient();
  const lastReportedErrorRef = useRef<unknown>(null);
  const explicitTurmaId = explicitTurmaIdFromLocation();
  const pendingTurmaId = useMemo(
    () => explicitTurmaId || readPendingClassGlossaryContext(),
    [explicitTurmaId, listId],
  );
  const queryKey = useMemo(
    () => [
      ...FOLDER_GLOSSARY_QUERY_KEY,
      "list",
      listId ?? "none",
      pendingTurmaId ? `turma:${pendingTurmaId}` : "folder",
    ] as const,
    [listId, pendingTurmaId],
  );
  const invalidate = () => queryClient.invalidateQueries({ queryKey, exact: true });

  const query = useQuery({
    queryKey,
    queryFn: () => loadListGlossaryContext({
      listId: listId as string,
      turmaId: pendingTurmaId,
      turmaIsExplicit: Boolean(explicitTurmaId),
    }),
    enabled: Boolean(listId),
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  const folderId = query.data?.folderId;
  const source = query.data?.source as ScopedGlossaryRuntimeSource | undefined;
  const recoveredFrom = query.data?.recoveredFrom ?? [];
  const glossary = (query.data?.glossary ?? EMPTY_GLOSSARY) as GlossaryEntry[];
  const activeGlossary = useMemo(
    () => glossary.every((entry) => entry.is_active)
      ? glossary
      : glossary.filter((entry) => entry.is_active),
    [glossary],
  );
  const status: ListGlossaryStatus = !listId
    ? "idle"
    : query.isLoading
      ? "loading"
      : query.isError
        ? "error"
        : activeGlossary.length > 0
          ? "ready"
          : "empty";

  useEffect(() => {
    if (!query.error) {
      lastReportedErrorRef.current = null;
      return;
    }
    if (lastReportedErrorRef.current === query.error) return;
    lastReportedErrorRef.current = query.error;
    const message = query.error instanceof Error
      ? query.error.message
      : "Não foi possível carregar o glossário desta lista.";
    toast.error(message, {
      description: "Os dados não foram apagados. Tente recarregar a lista.",
    });
  }, [query.error]);

  useEffect(() => {
    if (!import.meta.env.DEV || recoveredFrom.length === 0) return;
    console.warn("[GlossaryRuntime] leitura recuperada por fallback", {
      listId,
      folderId,
      source,
      recoveredFrom,
      loadedEntries: activeGlossary.length,
    });
  }, [activeGlossary.length, folderId, listId, recoveredFrom, source]);

  useEffect(() => subscribeFolderGlossaryRefresh((report) => {
    if (!folderId || report.folderId !== folderId) return;
    void queryClient.invalidateQueries({
      queryKey,
      exact: true,
      refetchType: "active",
    });
  }), [folderId, queryClient, queryKey]);

  const requireFolder = () => {
    if (!folderId) throw new Error("Abra uma lista vinculada a um glossário editável.");
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
      toast.success(source === "class-glossary"
        ? "Entrada adicionada ao glossário da turma."
        : "Entrada adicionada ao glossário da pasta.");
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
      toast.success(source === "class-glossary"
        ? "Entrada atualizada no glossário da turma."
        : "Entrada atualizada no glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => deleteFolderGlossaryEntries([id]),
    onSuccess: () => {
      void invalidate();
      announceEdit();
      toast.success(source === "class-glossary"
        ? "Entrada removida do glossário da turma."
        : "Entrada removida do glossário da pasta.");
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
      toast.success(source === "class-glossary"
        ? "Entradas removidas do glossário da turma."
        : "Entradas removidas do glossário da pasta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkSwapTerms = useMutation({
    mutationFn: async (ids: string[]) => {
      const selectedIds = new Set(ids);
      for (const entry of glossary.filter((item) => selectedIds.has(item.id))) {
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
      toast.success(source === "class-glossary"
        ? `Glossário da turma: ${result.inserted} nova(s), ${result.updated} alterada(s).`
        : `Glossário da pasta: ${result.inserted} nova(s), ${result.updated} alterada(s).`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    glossary,
    activeGlossary,
    folderId,
    status,
    source,
    recoveredFrom,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleActive,
    bulkDelete,
    bulkSwapTerms,
    importEntries,
  };
}
