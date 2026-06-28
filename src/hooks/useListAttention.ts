import { useResourceAttention, useToggleResourceAttention } from "@/hooks/useResourceAttention";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useListAttention(userId: string | undefined) {
  return useResourceAttention(userId, "list");
}

export function useToggleListAttention() {
  const mutation = useToggleResourceAttention();

  const mutate = async ({
    listId,
    isAttention,
  }: {
    listId: string;
    isAttention: boolean;
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) {
      toast.error("Sua sessão expirou. Entre novamente.");
      return;
    }

    mutation.mutate({
      userId,
      resourceType: "list",
      resourceId: listId,
      isAttention,
    });
  };

  return { ...mutation, mutate };
}
