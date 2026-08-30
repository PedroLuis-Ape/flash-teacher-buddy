import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SpecialFocusContext, SpecialFlashcardDetail } from "./useSpecialFlashcards";
import { setAttentionPoint, invalidateAttentionPointQueries } from "./useAttentionPoint";

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

interface UpdateSpecialFocusInput {
  specialId: string;
  flashcardId: string;
  institutionId?: string | null;
  focus: SpecialFocusContext;
}

export function useUpdateSpecialFocus(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ specialId, flashcardId, institutionId, focus }: UpdateSpecialFocusInput) => {
      if (!userId) throw new Error("Não autenticado");
      const result = await setAttentionPoint({
        sourceCardId: flashcardId,
        enabled: true,
        institutionId: institutionId ?? null,
        focus: {
          focus_text: clean(focus.focus_text),
          focus_side: focus.focus_side ?? null,
          focus_tag: focus.focus_tag ?? null,
          focus_note: clean(focus.focus_note),
        },
      });
      return { specialId, flashcardId, result };
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
      if (userId) invalidateAttentionPointQueries(queryClient, userId);
    },
  });
}
