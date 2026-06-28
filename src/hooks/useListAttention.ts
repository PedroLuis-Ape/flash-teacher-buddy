import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useResourceAttention } from "@/hooks/useResourceAttention";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useListAttention(userId: string | undefined) {
  return useResourceAttention(userId, "list");
}

export function useToggleListAttention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["list-attention-toggle"],
    mutationFn: async ({ listId, isAttention }: { listId: string; isAttention: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (!userId) throw new Error("Não autenticado");

      const key = `piteco:attention:${userId}:list`;
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
      const next = isAttention
        ? current.filter((id) => id !== listId)
        : Array.from(new Set([...current, listId]));
      window.localStorage.setItem(key, JSON.stringify(next));

      const { error } = isAttention
        ? await (supabase as any).from("user_list_attention").delete().eq("user_id", userId).eq("list_id", listId)
        : await (supabase as any).from("user_list_attention").insert({ user_id: userId, list_id: listId });

      const cloudPersisted = !error || error.code === "23505";
      if (error && error.code !== "23505") {
        console.warn("[list-attention] using device fallback", error);
      }

      return { listId, isAttention: !isAttention, userId, cloudPersisted };
    },
    onMutate: async ({ listId, isAttention }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (!userId) return;

      const queryKey = ["resource-attention", userId, "list"] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey) ?? [];
      queryClient.setQueryData<string[]>(queryKey, (current = []) =>
        isAttention
          ? current.filter((id) => id !== listId)
          : current.includes(listId) ? current : [...current, listId],
      );
      return { previous, queryKey };
    },
    onError: (error, _variables, context) => {
      if (context?.queryKey) queryClient.setQueryData(context.queryKey, context.previous);
      console.error("Error toggling list attention marker:", error);
      toast.error("Erro ao alterar a marca de atenção");
    },
    onSuccess: ({ isAttention, cloudPersisted }) => {
      toast.success(
        isAttention
          ? cloudPersisted ? "🔴 Lista marcada para prestar atenção" : "🔴 Lista marcada neste dispositivo"
          : "Marca de atenção removida",
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) queryClient.invalidateQueries({ queryKey: context.queryKey });
    },
  });
}
