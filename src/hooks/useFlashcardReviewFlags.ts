import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * “Revisar cards / Revisar depois” — QA de CONTEÚDO do flashcard.
 *
 * Domínio separado de Pontos de atenção (`special-flashcards`): lá é dificuldade
 * pedagógica e exportação para IA; aqui é “esse card parece ter um problema”.
 * A identidade é o FLASHCARD EXATO (camada exata), nunca o `source_group_uid`.
 *
 * Supabase é a autoridade — nada de localStorage decidindo a fila.
 */
export const reviewFlagKeys = {
  ids: (userId?: string | null) => ["flashcard-review-flags", userId ?? "anon"] as const,
  details: (userId?: string | null) => ["flashcard-review-flags-details", userId ?? "anon"] as const,
  count: (userId?: string | null) => ["flashcard-review-flags-count", userId ?? "anon"] as const,
};

export interface FlashcardReviewFlag {
  id: string;
  flashcard_id: string;
  source_group_uid: string | null;
  source_list_id: string | null;
  institution_id: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TABLE = "user_flashcard_review_flags";

/**
 * A migration é aditiva e pode ainda não estar aplicada no ambiente em uso.
 * Nesse caso a feature degrada para “nada marcado” em vez de derrubar o estudo.
 */
export function isMissingReviewFlagsTable(error: unknown): boolean {
  const err = error as { message?: string; details?: string; hint?: string; code?: string } | null | undefined;
  const text = `${err?.message ?? ""} ${err?.details ?? ""} ${err?.hint ?? ""} ${err?.code ?? ""}`.toLowerCase();
  return text.includes(TABLE) || text.includes("does not exist") || text.includes("pgrst205") || text.includes("42p01");
}

function client() {
  return supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };
}

/** IDs dos flashcards com revisão ABERTA. Carregado uma vez por usuário. */
export function useFlashcardReviewFlags(userId?: string | null) {
  const query = useQuery({
    queryKey: reviewFlagKeys.ids(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await client()
        .from(TABLE)
        .select("flashcard_id")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (error) {
        if (isMissingReviewFlagsTable(error)) return [];
        throw error;
      }
      return (Array.isArray(data) ? data : [])
        .map((row: { flashcard_id?: unknown }) => (typeof row.flashcard_id === "string" ? row.flashcard_id : null))
        .filter((id: string | null): id is string => Boolean(id));
    },
  });

  return { flaggedIds: new Set<string>(query.data ?? []), ...query };
}

/** Linhas completas da fila aberta (para a central de revisão). */
export function useFlashcardReviewFlagDetails(userId?: string | null) {
  return useQuery({
    queryKey: reviewFlagKeys.details(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<FlashcardReviewFlag[]> => {
      const { data, error } = await client()
        .from(TABLE)
        .select("id,flashcard_id,source_group_uid,source_list_id,institution_id,reason,note,created_at,resolved_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingReviewFlagsTable(error)) return [];
        throw error;
      }
      return (Array.isArray(data) ? data : []) as FlashcardReviewFlag[];
    },
  });
}

export function useFlashcardReviewFlagCount(userId?: string | null) {
  const { data } = useFlashcardReviewFlags(userId);
  return data?.length ?? 0;
}

export function invalidateFlashcardReviewQueries(queryClient: QueryClient, userId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: reviewFlagKeys.ids(userId) });
  void queryClient.invalidateQueries({ queryKey: reviewFlagKeys.details(userId) });
  void queryClient.invalidateQueries({ queryKey: reviewFlagKeys.count(userId) });
}

export interface ToggleReviewFlagInput {
  flashcardId: string;
  enabled: boolean;
  reason?: string | null;
  note?: string | null;
  institutionId?: string | null;
}

/**
 * Toggle com update otimista: o botão responde na hora; em erro faz rollback e
 * avisa. Nunca mexe em progresso, sessão, favoritos, Lista Vermelha, Reforço ou
 * Pontos de atenção — a flag é metadata lateral.
 */
export function useFlashcardReviewFlagMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flashcardId, enabled, reason, note, institutionId }: ToggleReviewFlagInput) => {
      const { data, error } = await client().rpc("set_user_flashcard_review_flag", {
        _flashcard_id: flashcardId,
        _enabled: enabled,
        _institution_id: institutionId ?? null,
        _reason: reason ?? null,
        _note: note ?? null,
      });
      if (error) throw error;
      return data as { enabled?: boolean; flag_id?: string | null; flashcard_id?: string } | null;
    },
    onMutate: async ({ flashcardId, enabled }) => {
      const key = reviewFlagKeys.ids(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key) ?? [];
      const next = enabled
        ? Array.from(new Set([...previous, flashcardId]))
        : previous.filter((id) => id !== flashcardId);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) queryClient.setQueryData(reviewFlagKeys.ids(userId), context.previous);
      toast.error(
        isMissingReviewFlagsTable(error)
          ? "Revisar cards ainda não está ativo neste ambiente (migration pendente)."
          : "Não foi possível salvar a marcação para revisão.",
      );
    },
    onSettled: () => {
      invalidateFlashcardReviewQueries(queryClient, userId);
    },
  });
}
