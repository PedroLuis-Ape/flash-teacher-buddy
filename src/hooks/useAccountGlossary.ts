import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";
import type { AccountGlossaryEntry } from "@/features/study/lib/accountGlossaryTypes";
import {
  addAccountGlossaryEntry,
  deleteAccountGlossaryEntries,
  importAccountGlossary,
  loadAccountGlossaryForList,
  loadOwnAccountGlossary,
  updateAccountGlossaryEntry,
} from "@/features/study/lib/accountGlossaryApi";

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

export const ACCOUNT_GLOSSARY_QUERY_KEY = ["account-glossary"] as const;

export function useAccountGlossary(listId?: string) {
  const queryClient = useQueryClient();
  const queryKey = [...ACCOUNT_GLOSSARY_QUERY_KEY, listId ?? "self"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY });

  const { data: glossary = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => listId ? loadAccountGlossaryForList(listId) : loadOwnAccountGlossary(),
    staleTime: 5 * 60_000,
    gcTime: 20 * 60_000,
  });

  const addEntry = useMutation({
    mutationFn: async ({ list_id: _listId, ...entry }: GlossaryInsert) => {
      await addAccountGlossaryEntry({
        ...entry,
        note: entry.note ?? null,
        is_active: entry.is_active ?? true,
      });
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Entrada adicionada à sua caixa de glossário.");
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, owner_id: _ownerId, list_id: _listId, created_at: _createdAt, updated_at: _updatedAt, ...fields }: Partial<GlossaryEntry> & { id: string }) => {
      await updateAccountGlossaryEntry(id, fields);
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Entrada atualizada na caixa central.");
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => deleteAccountGlossaryEntries([id]),
    onSuccess: () => {
      void invalidate();
      toast.success("Entrada removida da caixa central.");
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateAccountGlossaryEntry(id, { is_active }),
    onSuccess: () => void invalidate(),
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const bulkDelete = useMutation({
    mutationFn: deleteAccountGlossaryEntries,
    onSuccess: (_data, ids) => {
      void invalidate();
      toast.success(`${ids.length} entrada(s) removida(s) da caixa central.`);
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const bulkSwapTerms = useMutation({
    mutationFn: async (ids: string[]) => {
      const selected = glossary.filter((entry) => ids.includes(entry.id));
      for (const entry of selected) {
        await updateAccountGlossaryEntry(entry.id, {
          original_text: entry.translated_text,
          translated_text: entry.original_text,
          side: entry.side === "A" ? "B" : "A",
        });
      }
    },
    onSuccess: (_data, ids) => {
      void invalidate();
      toast.success(`${ids.length} termo(s) invertido(s) na caixa central.`);
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const importEntries = useMutation({
    mutationFn: async (entries: GlossaryTransferEntry[]): Promise<GlossaryImportResult> => {
      const result = await importAccountGlossary(entries, false);
      return {
        inserted: Number(result.inserted ?? 0),
        updated: Number(result.updated ?? 0),
        skipped: Number(result.skipped ?? 0),
      };
    },
    onSuccess: (result) => {
      void invalidate();
      toast.success(`Caixa atualizada: ${result.inserted} nova(s), ${result.skipped} já existente(s).`);
    },
    onError: (mutationError: any) => toast.error("Erro ao importar glossário: " + mutationError.message),
  });

  return {
    glossary,
    activeGlossary: glossary.filter((entry) => entry.is_active),
    isLoading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleActive,
    bulkDelete,
    bulkSwapTerms,
    importEntries,
  };
}
