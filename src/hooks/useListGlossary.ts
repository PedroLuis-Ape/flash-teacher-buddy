import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  glossaryEntryIdentity,
  type GlossaryTransferEntry,
} from "@/features/study/lib/glossaryTransfer";

export interface GlossaryEntry {
  id: string;
  list_id: string;
  original_text: string;
  translated_text: string;
  note: string | null;
  side: "A" | "B";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GlossaryInsert = Pick<GlossaryEntry, "list_id" | "original_text" | "translated_text" | "side"> & {
  note?: string;
  is_active?: boolean;
};

export interface GlossaryImportResult {
  inserted: number;
  updated: number;
  skipped: number;
}

const GLOSSARY_PAGE_SIZE = 1000;

export function useListGlossary(listId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["list-glossary", listId];

  const { data: glossary = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!listId) return [];
      const rows: GlossaryEntry[] = [];
      let from = 0;

      while (true) {
        const { data, error: queryError } = await supabase
          .from("list_glossary")
          .select("*")
          .eq("list_id", listId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + GLOSSARY_PAGE_SIZE - 1);
        if (queryError) throw queryError;
        rows.push(...((data || []) as GlossaryEntry[]));
        if ((data?.length ?? 0) < GLOSSARY_PAGE_SIZE) break;
        from += GLOSSARY_PAGE_SIZE;
      }

      return rows;
    },
    enabled: !!listId,
    staleTime: 60_000,
  });

  const activeGlossary = glossary.filter((entry) => entry.is_active);

  const addEntry = useMutation({
    mutationFn: async (entry: GlossaryInsert) => {
      const identity = glossaryEntryIdentity({
        side: entry.side,
        original_text: entry.original_text,
        translated_text: entry.translated_text,
      });
      if (glossary.some((existing) => glossaryEntryIdentity(existing) === identity)) {
        throw new Error("Essa tradução já existe no glossário.");
      }
      const { error: insertError } = await supabase.from("list_glossary").insert(entry as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Tradução adicionada como uma nova camada.");
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<GlossaryEntry> & { id: string }) => {
      const { error: updateError } = await supabase
        .from("list_glossary")
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Tradução atualizada.");
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from("list_glossary").delete().eq("id", id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Camada removida do glossário.");
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error: toggleError } = await supabase
        .from("list_glossary")
        .update({ is_active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (toggleError) throw toggleError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: deleteError } = await supabase.from("list_glossary").delete().in("id", ids);
      if (deleteError) throw deleteError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${variables.length} camada(s) removida(s).`);
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const bulkSwapTerms = useMutation({
    mutationFn: async (ids: string[]) => {
      const entries = glossary.filter((entry) => ids.includes(entry.id));
      if (entries.length === 0) return;
      const results = await Promise.all(entries.map((entry) =>
        supabase
          .from("list_glossary")
          .update({
            original_text: entry.translated_text,
            translated_text: entry.original_text,
            side: entry.side === "A" ? "B" : "A",
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", entry.id),
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${variables.length} termo(s) invertido(s), incluindo o lado de origem.`);
    },
    onError: (mutationError: any) => toast.error("Erro: " + mutationError.message),
  });

  const importEntries = useMutation({
    mutationFn: async (entries: GlossaryTransferEntry[]): Promise<GlossaryImportResult> => {
      if (!listId) throw new Error("Lista não identificada.");

      const existingByIdentity = new Map(glossary.map((entry) => [glossaryEntryIdentity(entry), entry]));
      const inserts: Array<GlossaryTransferEntry & { list_id: string }> = [];
      const updates: Array<{ id: string; entry: GlossaryTransferEntry }> = [];
      let skipped = 0;

      for (const entry of entries) {
        const identity = glossaryEntryIdentity(entry);
        const existing = existingByIdentity.get(identity);
        if (!existing) {
          inserts.push({ ...entry, list_id: listId });
          existingByIdentity.set(identity, { ...entry, list_id: listId } as GlossaryEntry);
          continue;
        }

        const normalizedNote = entry.note?.trim() || null;
        if (existing.note !== normalizedNote || existing.is_active !== entry.is_active) {
          updates.push({ id: existing.id, entry: { ...entry, note: normalizedNote } });
        } else {
          skipped += 1;
        }
      }

      const chunkSize = 100;
      for (let index = 0; index < inserts.length; index += chunkSize) {
        const chunk = inserts.slice(index, index + chunkSize);
        const { error: insertError } = await supabase.from("list_glossary").insert(chunk as any);
        if (insertError) throw insertError;
      }

      for (let index = 0; index < updates.length; index += chunkSize) {
        const chunk = updates.slice(index, index + chunkSize);
        const results = await Promise.all(chunk.map(({ id, entry }) =>
          supabase
            .from("list_glossary")
            .update({
              note: entry.note ?? null,
              is_active: entry.is_active,
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", id),
        ));
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;
      }

      return { inserted: inserts.length, updated: updates.length, skipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      const parts = [
        result.inserted > 0 ? `${result.inserted} nova(s)` : "",
        result.updated > 0 ? `${result.updated} atualizada(s)` : "",
        result.skipped > 0 ? `${result.skipped} já existente(s)` : "",
      ].filter(Boolean);
      toast.success(`Glossário importado: ${parts.join(", ") || "sem alterações"}.`);
    },
    onError: (mutationError: any) => toast.error("Erro ao importar glossário: " + mutationError.message),
  });

  return {
    glossary,
    activeGlossary,
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
