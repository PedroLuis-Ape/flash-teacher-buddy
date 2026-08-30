import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SpecialFocusContext, SpecialFlashcardDetail } from "./useSpecialFlashcards";

export interface AttentionPointMutationInput {
  sourceCardId: string;
  enabled: boolean;
  institutionId?: string | null;
  sourceGroupId?: string | null;
  focus?: SpecialFocusContext | null;
}

export interface AttentionPointMutationResult {
  enabled: boolean;
  source_card_id: string;
  source_group_id: string;
  point_id: string | null;
  attention_area_id?: string | null;
  area_folder_id?: string | null;
  area_list_id?: string | null;
  materialization_group_id?: string | null;
  materialization_list_id?: string | null;
  materialization_layer_ids?: string[];
}

export interface AttentionPointBulkInput {
  sourceCardIds: string[];
  enabled: boolean;
  institutionId?: string | null;
}

function normalizeRpcResult(value: unknown): AttentionPointMutationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resposta inválida do serviço de Pontos de atenção.");
  }
  return value as AttentionPointMutationResult;
}

function normalizeFocus(focus?: SpecialFocusContext | null) {
  if (!focus) return null;
  const clean = (value?: string | null) => {
    if (typeof value !== "string") return value ?? null;
    const trimmed = value.trim();
    return trimmed || null;
  };
  return {
    focus_text: clean(focus.focus_text),
    focus_side: focus.focus_side ?? null,
    focus_tag: focus.focus_tag ?? null,
    focus_note: clean(focus.focus_note),
  };
}

export async function setAttentionPoint(
  input: AttentionPointMutationInput,
): Promise<AttentionPointMutationResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Não autenticado");

  const { data, error } = await (supabase as any).rpc("set_user_attention_point", {
    _flashcard_id: input.sourceCardId,
    _enabled: input.enabled,
    _institution_id: input.institutionId ?? null,
    _focus: normalizeFocus(input.focus),
  });
  if (error) throw error;
  return normalizeRpcResult(data);
}

export async function setAttentionPoints(
  input: AttentionPointBulkInput,
): Promise<AttentionPointMutationResult[]> {
  if (input.sourceCardIds.length === 0) return [];
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Não autenticado");

  const { data, error } = await (supabase as any).rpc("set_user_attention_points", {
    _flashcard_ids: Array.from(new Set(input.sourceCardIds)),
    _enabled: input.enabled,
    _institution_id: input.institutionId ?? null,
    _focus: null,
  });
  if (error) throw error;

  const items = data && typeof data === "object" && Array.isArray((data as any).items)
    ? (data as any).items
    : [];
  return items.map(normalizeRpcResult);
}

function optimisticGroupId(input: AttentionPointMutationInput): string {
  return input.sourceGroupId ?? input.sourceCardId;
}

export function invalidateAttentionPointQueries(
  queryClient: QueryClient,
  userId: string,
  result?: Partial<AttentionPointMutationResult> | null,
) {
  void queryClient.invalidateQueries({ queryKey: ["special-flashcards", userId] });
  void queryClient.invalidateQueries({ queryKey: ["special-flashcards-count", userId] });
  void queryClient.invalidateQueries({ queryKey: ["special-flashcards-details", userId] });
  void queryClient.invalidateQueries({ queryKey: ["library", "snapshot", userId] });
  void queryClient.invalidateQueries({ queryKey: ["home-data", userId] });

  const listIds = new Set<string>();
  for (const listId of [result?.area_list_id, result?.materialization_list_id]) {
    if (listId) listIds.add(listId);
  }
  for (const listId of listIds) {
    void queryClient.invalidateQueries({ queryKey: ["flashcards", listId] });
    void queryClient.invalidateQueries({ queryKey: ["list", listId] });
  }
}

interface AttentionMutationContext {
  userId: string;
  previousIds?: string[];
  previousCount?: number;
  previousDetails?: SpecialFlashcardDetail[];
}

export function useAttentionPointMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<AttentionPointMutationResult, Error, AttentionPointMutationInput, AttentionMutationContext>({
    mutationFn: setAttentionPoint,
    onMutate: async (input) => {
      if (!userId) throw new Error("Não autenticado");
      const idsKey = ["special-flashcards", userId] as const;
      const countKey = ["special-flashcards-count", userId] as const;
      const detailsKey = ["special-flashcards-details", userId] as const;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: idsKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
        queryClient.cancelQueries({ queryKey: detailsKey }),
      ]);

      const previousIds = queryClient.getQueryData<string[]>(idsKey);
      const previousCount = queryClient.getQueryData<number>(countKey);
      const previousDetails = queryClient.getQueryData<SpecialFlashcardDetail[]>(detailsKey);
      const groupId = optimisticGroupId(input);
      const affectedGroupIds = new Set([groupId]);
      for (const detail of previousDetails ?? []) {
        if (
          detail.flashcard_id === input.sourceCardId
          || detail.source_group_id === groupId
          || detail.materialization_group_id === groupId
        ) {
          if (detail.source_group_id) affectedGroupIds.add(detail.source_group_id);
          if (detail.materialization_group_id) affectedGroupIds.add(detail.materialization_group_id);
        }
      }
      const alreadyMarked = previousIds
        ? [...affectedGroupIds].filter((id) => previousIds.includes(id)).length
        : 0;

      queryClient.setQueryData<string[]>(idsKey, (current = []) => {
        if (!input.enabled) return current.filter((id) => !affectedGroupIds.has(id));
        return current.includes(groupId) ? current : [...current, groupId];
      });
      queryClient.setQueryData<number>(countKey, (current = 0) => {
        if (!input.enabled) return alreadyMarked ? Math.max(0, current - 1) : current;
        return alreadyMarked ? current : current + 1;
      });
      if (!input.enabled) {
        queryClient.setQueryData<SpecialFlashcardDetail[]>(detailsKey, (current = []) =>
          current.filter((card) =>
            card.flashcard_id !== input.sourceCardId
            && !affectedGroupIds.has(card.source_group_id ?? "")
            && !affectedGroupIds.has(card.materialization_group_id ?? "")
          )
        );
      }

      return { userId, previousIds, previousCount, previousDetails };
    },
    onError: (error, _input, context) => {
      if (!context) return;
      if (context.previousIds !== undefined) queryClient.setQueryData(["special-flashcards", context.userId], context.previousIds);
      if (context.previousCount !== undefined) queryClient.setQueryData(["special-flashcards-count", context.userId], context.previousCount);
      if (context.previousDetails !== undefined) queryClient.setQueryData(["special-flashcards-details", context.userId], context.previousDetails);
      console.error("[attention-point] mutation failed", error);
      toast.error(error.message || "Erro ao atualizar o ponto de atenção.");
    },
    onSuccess: (result) => {
      toast.success(result.enabled ? "Salvo nos pontos de atenção" : "Removido dos pontos de atenção");
    },
    onSettled: (result, _error, _input, context) => {
      if (context) invalidateAttentionPointQueries(queryClient, context.userId, result);
    },
  });
}

export function useAttentionPointsMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<AttentionPointMutationResult[], Error, AttentionPointBulkInput, AttentionMutationContext>({
    mutationFn: setAttentionPoints,
    onMutate: async (input) => {
      if (!userId) throw new Error("Não autenticado");
      const idsKey = ["special-flashcards", userId] as const;
      const countKey = ["special-flashcards-count", userId] as const;
      const detailsKey = ["special-flashcards-details", userId] as const;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: idsKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
        queryClient.cancelQueries({ queryKey: detailsKey }),
      ]);
      const previousIds = queryClient.getQueryData<string[]>(idsKey);
      const previousCount = queryClient.getQueryData<number>(countKey);
      const previousDetails = queryClient.getQueryData<SpecialFlashcardDetail[]>(detailsKey);
      const targetIds = new Set(input.sourceCardIds);
      const targetGroupIds = new Set(targetIds);
      for (const detail of previousDetails ?? []) {
        if (targetIds.has(detail.flashcard_id) && detail.source_group_id) {
          targetGroupIds.add(detail.source_group_id);
        }
      }
      const alreadyMarked = previousIds ? [...targetGroupIds].filter((id) => previousIds.includes(id)).length : 0;

      queryClient.setQueryData<string[]>(idsKey, (current = []) => {
        if (!input.enabled) return current.filter((id) => !targetGroupIds.has(id));
        return Array.from(new Set([...current, ...targetGroupIds]));
      });
      queryClient.setQueryData<number>(countKey, (current = 0) => {
        if (!input.enabled) return Math.max(0, current - alreadyMarked);
        return current + [...targetGroupIds].filter((id) => !previousIds?.includes(id)).length;
      });
      if (!input.enabled) {
        queryClient.setQueryData<SpecialFlashcardDetail[]>(detailsKey, (current = []) =>
          current.filter((card) => !targetIds.has(card.flashcard_id) && !targetGroupIds.has(card.source_group_id ?? ""))
        );
      }
      return { userId, previousIds, previousCount, previousDetails };
    },
    onError: (error, _input, context) => {
      if (!context) return;
      if (context.previousIds !== undefined) queryClient.setQueryData(["special-flashcards", context.userId], context.previousIds);
      if (context.previousCount !== undefined) queryClient.setQueryData(["special-flashcards-count", context.userId], context.previousCount);
      if (context.previousDetails !== undefined) queryClient.setQueryData(["special-flashcards-details", context.userId], context.previousDetails);
      console.error("[attention-point] bulk mutation failed", error);
      toast.error(error.message || "Erro ao atualizar os pontos de atenção.");
    },
    onSettled: (results, _error, _input, context) => {
      if (!context) return;
      for (const result of results ?? []) invalidateAttentionPointQueries(queryClient, context.userId, result);
      if (!results?.length) invalidateAttentionPointQueries(queryClient, context.userId);
    },
  });
}
