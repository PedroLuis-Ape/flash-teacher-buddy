import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLiveFlashcardIdSet,
  retainLiveFlashcardIds,
} from "@/features/cards/lib/liveFlashcardIds";

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

export type FlashcardReviewReason =
  | "translation"
  | "context"
  | "grammar"
  | "typo"
  | "naturalness"
  | "answer"
  | "audio"
  | "other";

export const FLASHCARD_REVIEW_REASONS: Array<{ value: FlashcardReviewReason; label: string }> = [
  { value: "translation", label: "Tradução" },
  { value: "context", label: "Contexto" },
  { value: "grammar", label: "Gramática" },
  { value: "typo", label: "Erro de digitação" },
  { value: "naturalness", label: "Uso natural" },
  { value: "answer", label: "Resposta" },
  { value: "audio", label: "Áudio" },
  { value: "other", label: "Outro" },
];

export interface FlashcardReviewFlag {
  id: string;
  flashcard_id: string;
  source_group_uid: string | null;
  source_list_id: string | null;
  institution_id: string | null;
  reason: FlashcardReviewReason | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  return text.includes(TABLE) || text.includes("set_user_flashcard_review_flag") || text.includes("update_user_flashcard_review_flag_metadata") || text.includes("does not exist") || text.includes("pgrst205") || text.includes("42p01");
}

function client() {
  return supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };
}

/** IDs dos flashcards com revisão ABERTA. Carregado uma vez por usuário. */
export function useFlashcardReviewFlags(userId?: string | null) {
  const query = useQuery({
    queryKey: reviewFlagKeys.ids(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
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
      const ids = Array.from(new Set(
        (Array.isArray(data) ? data : [])
          .map((row: { flashcard_id?: unknown }) => (typeof row.flashcard_id === "string" ? row.flashcard_id : null))
          .filter((id: string | null): id is string => Boolean(id)),
      ));
      // Card inexistente ou na lixeira nao e referencia valida para a fila.
      return retainLiveFlashcardIds(ids);
    },
  });

  return { flaggedIds: new Set<string>(query.data ?? []), ...query };
}

/** Linhas completas da fila aberta (para a central de revisão). */
export function useFlashcardReviewFlagDetails(userId?: string | null) {
  return useQuery({
    queryKey: reviewFlagKeys.details(userId),
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    queryFn: async (): Promise<FlashcardReviewFlag[]> => {
      const { data, error } = await client()
        .from(TABLE)
        .select("id,flashcard_id,source_group_uid,source_list_id,institution_id,reason,note,is_active,created_at,updated_at,resolved_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingReviewFlagsTable(error)) return [];
        throw error;
      }
      const rows = (Array.isArray(data) ? data : []) as FlashcardReviewFlag[];
      if (rows.length === 0) return rows;
      const live = await fetchLiveFlashcardIdSet(rows.map((row) => row.flashcard_id));
      return rows.filter((row) => live.has(row.flashcard_id));
    },
  });
}

export function useFlashcardReviewFlagCount(userId?: string | null) {
  const query = useFlashcardReviewFlags(userId);
  return query.data?.length ?? 0;
}

export function invalidateFlashcardReviewQueries(queryClient: QueryClient, userId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: reviewFlagKeys.ids(userId) });
  void queryClient.invalidateQueries({ queryKey: reviewFlagKeys.details(userId) });
  void queryClient.invalidateQueries({ queryKey: reviewFlagKeys.count(userId) });
}

export interface ToggleReviewFlagInput {
  flashcardId: string;
  enabled: boolean;
  reason?: FlashcardReviewReason | null;
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
      if (!userId) throw new Error("Não autenticado");
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
    onSuccess: (_result, variables) => {
      toast.success(variables.enabled ? "Salvo para revisar depois" : "Revisão concluída");
    },
    onSettled: () => {
      invalidateFlashcardReviewQueries(queryClient, userId);
    },
  });
}

export interface UpdateReviewFlagMetadataInput {
  flagId: string;
  reason: FlashcardReviewReason | null;
  note: string | null;
}

/** Atualiza somente a classificação/anotação da fila; nunca o flashcard. */
export function useFlashcardReviewFlagMetadataMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flagId, reason, note }: UpdateReviewFlagMetadataInput) => {
      if (!userId) throw new Error("Não autenticado");
      const { data, error } = await client().rpc("update_user_flashcard_review_flag_metadata", {
        _flag_id: flagId,
        _reason: reason,
        _note: note,
      });
      if (error) throw error;
      return data as { flag_id?: string; reason?: FlashcardReviewReason | null; note?: string | null } | null;
    },
    onMutate: async ({ flagId, reason, note }) => {
      const key = reviewFlagKeys.details(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FlashcardReviewFlag[]>(key) ?? [];
      const now = new Date().toISOString();
      queryClient.setQueryData<FlashcardReviewFlag[]>(key, previous.map((flag) =>
        flag.id === flagId ? { ...flag, reason, note, updated_at: now } : flag,
      ));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) queryClient.setQueryData(reviewFlagKeys.details(userId), context.previous);
      toast.error(
        isMissingReviewFlagsTable(error)
          ? "A fila de revisão ainda não está ativa neste ambiente."
          : "Não foi possível atualizar os detalhes da revisão.",
      );
    },
    onSuccess: () => toast.success("Detalhes da revisão salvos"),
    onSettled: () => invalidateFlashcardReviewQueries(queryClient, userId),
  });
}
