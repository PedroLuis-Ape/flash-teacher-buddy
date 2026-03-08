import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useListGlossary(listId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["list-glossary", listId];

  const { data: glossary = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!listId) return [];
      const { data, error } = await supabase
        .from("list_glossary")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as GlossaryEntry[];
    },
    enabled: !!listId,
    staleTime: 60_000,
  });

  const activeGlossary = glossary.filter((g) => g.is_active);

  const addEntry = useMutation({
    mutationFn: async (entry: GlossaryInsert) => {
      const { error } = await supabase.from("list_glossary").insert(entry as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Tradução global adicionada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<GlossaryEntry> & { id: string }) => {
      const { error } = await supabase
        .from("list_glossary")
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Tradução global atualizada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_glossary").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Tradução global removida!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("list_glossary")
        .update({ is_active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("list_glossary")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${variables.length} tradução(ões) removida(s)!`);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    glossary,
    activeGlossary,
    isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleActive,
    bulkDelete,
  };
}
