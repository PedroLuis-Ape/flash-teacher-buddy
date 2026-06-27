import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { toast } from "sonner";

async function fetchAttentionListIds(userId: string): Promise<string[]> {
  const rows = await fetchAllSupabaseRows<{ list_id: string }>((from, to) =>
    (supabase as any)
      .from("user_list_attention")
      .select("list_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  return rows.map((row) => row.list_id);
}

export function useListAttention(userId: string | undefined) {
  return useQuery({
    queryKey: ["list-attention", userId],
    queryFn: async () => {
      if (!userId) return [];
      return fetchAttentionListIds(userId);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useToggleListAttention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["list-attention-toggle"],
    mutationFn: async ({ listId, isAttention }: { listId: string; isAttention: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (isAttention) {
        const { error } = await (supabase as any)
          .from("user_list_attention")
          .delete()
          .eq("user_id", user.id)
          .eq("list_id", listId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_list_attention")
          .insert({ user_id: user.id, list_id: listId });
        if (error && error.code !== "23505") throw error;
      }

      return { listId, isAttention: !isAttention, userId: user.id };
    },
    onMutate: async ({ listId, isAttention }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const queryKey = ["list-attention", user.id] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey) ?? [];

      queryClient.setQueryData<string[]>(queryKey, (current = []) => {
        if (isAttention) return current.filter((id) => id !== listId);
        return current.includes(listId) ? current : [...current, listId];
      });

      return { previous, queryKey };
    },
    onError: (error, _variables, context) => {
      if (context?.queryKey) queryClient.setQueryData(context.queryKey, context.previous);
      console.error("Error toggling list attention marker:", error);
      toast.error("Erro ao alterar a marca de atenção");
    },
    onSuccess: ({ isAttention }) => {
      toast.success(isAttention ? "🔴 Lista marcada para prestar atenção" : "Marca de atenção removida");
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) queryClient.invalidateQueries({ queryKey: context.queryKey });
    },
  });
}
