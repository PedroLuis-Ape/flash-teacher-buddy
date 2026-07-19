import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SpecialFocusContext, SpecialFlashcardDetail } from "./useSpecialFlashcards";

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

interface UpdateSpecialFocusInput {
  specialId: string;
  flashcardId: string;
  focus: SpecialFocusContext;
}

export function useUpdateSpecialFocus(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ specialId, flashcardId, focus }: UpdateSpecialFocusInput) => {
      if (!userId) throw new Error("Não autenticado");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || authData.user?.id !== userId) throw new Error("Sessão inválida");

      const payload = {
        focus_text: clean(focus.focus_text),
        focus_side: focus.focus_side ?? null,
        focus_tag: focus.focus_tag ?? null,
        focus_note: clean(focus.focus_note),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("user_special_flashcards" as any)
        .update(payload as any)
        .eq("id", specialId)
        .eq("user_id", userId)
        .eq("flashcard_id", flashcardId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Card Especial não encontrado ou sem permissão para editar.");
      return { specialId, flashcardId, payload };
    },
    onMutate: async ({ specialId, focus }) => {
      if (!userId) return undefined;
      const key = ["special-flashcards-details", userId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SpecialFlashcardDetail[]>(key);
      queryClient.setQueryData<SpecialFlashcardDetail[]>(key, (current = []) => current.map((card) => (
        card.id === specialId
          ? {
              ...card,
              focus_text: clean(focus.focus_text),
              focus_side: focus.focus_side ?? null,
              focus_tag: focus.focus_tag ?? null,
              focus_note: clean(focus.focus_note),
              updated_at: new Date().toISOString(),
            }
          : card
      )));
      return { previous, key };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      console.error("[special-focus] Falha ao atualizar foco", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o foco.");
    },
    onSuccess: () => toast.success("Foco pedagógico atualizado."),
    onSettled: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ["special-flashcards-details", userId] });
    },
  });
}
