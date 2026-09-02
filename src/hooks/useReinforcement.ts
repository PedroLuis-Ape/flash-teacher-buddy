import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReinforcementArea {
  id: string;
  institution_id: string | null;
  folder_id: string;
  list_id: string;
}

export interface ReinforcementItem {
  id: string;
  source_card_id: string;
  source_group_uid: string;
  source_list_id: string | null;
  materialization_list_id: string | null;
  materialization_group_id: string | null;
  term: string;
  translation: string;
  layer_count: number;
  /** IDs recognized by Study while the source or materialized group is open. */
  active_ids: string[];
}

export interface ReinforcementSnapshot {
  area: ReinforcementArea | null;
  items: ReinforcementItem[];
}

export interface ReinforcementMutationInput {
  sourceCardId: string;
  enabled: boolean;
  institutionId?: string | null;
  sourceGroupId?: string | null;
}

export interface ReinforcementMutationResult {
  enabled: boolean;
  source_card_id: string;
  source_group_uid: string;
  point_id: string | null;
  area_folder_id?: string | null;
  area_list_id?: string | null;
  materialization_group_id?: string | null;
  materialization_list_id?: string | null;
  materialization_layer_ids?: string[];
}

export const reinforcementKeys = {
  all: ["reinforcement"] as const,
  snapshot: (userId: string, institutionId: string | null) =>
    ["reinforcement", "snapshot", userId, institutionId ?? "general"] as const,
};

function applyInstitutionFilter(query: any, institutionId: string | null) {
  return institutionId
    ? query.eq("institution_id", institutionId)
    : query.is("institution_id", null);
}

export async function fetchReinforcementSnapshot(
  userId: string,
  institutionId: string | null,
): Promise<ReinforcementSnapshot> {
  let areaQuery = supabase
    .from("user_reinforcement_areas" as any)
    .select("id, institution_id, folder_id, list_id")
    .eq("user_id", userId);
  areaQuery = applyInstitutionFilter(areaQuery, institutionId);
  const { data: areaData, error: areaError } = await areaQuery.maybeSingle();
  if (areaError) throw areaError;

  const area = (areaData as ReinforcementArea | null) ?? null;
  if (!area) return { area: null, items: [] };

  let pointsQuery = supabase
    .from("user_reinforcement_points" as any)
    .select("id, source_card_id, source_group_uid, source_list_id, materialization_list_id, materialization_group_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  pointsQuery = applyInstitutionFilter(pointsQuery, institutionId);
  const { data: pointData, error: pointError } = await pointsQuery;
  if (pointError) throw pointError;

  const points = (pointData as any[]) ?? [];
  if (!points.length) return { area, items: [] };

  const { data: cards, error: cardsError } = await supabase
    .from("flashcards")
    .select("id, list_id, term, translation, parent_card_id, status_group_uid, deleted_at")
    .eq("list_id", area.list_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (cardsError) throw cardsError;

  const cloneCards = (cards as any[]) ?? [];
  const items: ReinforcementItem[] = points
    .map((point) => {
      const groupCards = cloneCards.filter((card) =>
        card.id === point.materialization_group_id
        || card.parent_card_id === point.materialization_group_id,
      );
      const root = groupCards.find((card) => card.id === point.materialization_group_id);
      if (!root) return null;
      const activeIds = new Set<string>([
        point.source_card_id,
        point.source_group_uid,
        point.materialization_group_id,
        ...groupCards.flatMap((card) => [card.id, card.status_group_uid]).filter(Boolean),
      ]);
      return {
        id: point.id,
        source_card_id: point.source_card_id,
        source_group_uid: point.source_group_uid,
        source_list_id: point.source_list_id ?? null,
        materialization_list_id: point.materialization_list_id ?? null,
        materialization_group_id: point.materialization_group_id ?? null,
        term: root.term ?? "Sem título",
        translation: root.translation ?? "",
        layer_count: groupCards.length,
        active_ids: Array.from(activeIds),
      };
    })
    .filter((item): item is ReinforcementItem => Boolean(item));

  return { area, items };
}

export async function setReinforcementPoint(
  input: ReinforcementMutationInput,
): Promise<ReinforcementMutationResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Não autenticado");
  const { data, error } = await (supabase as any).rpc("set_user_reinforcement_point", {
    _flashcard_id: input.sourceCardId,
    _enabled: input.enabled,
    _institution_id: input.institutionId ?? null,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Resposta inválida do serviço de Reforço.");
  }
  return data as ReinforcementMutationResult;
}

export function invalidateReinforcementQueries(
  queryClient: QueryClient,
  userId: string,
  institutionId?: string | null,
  result?: Partial<ReinforcementMutationResult> | null,
) {
  if (institutionId !== undefined) {
    void queryClient.invalidateQueries({ queryKey: reinforcementKeys.snapshot(userId, institutionId ?? null) });
  } else {
    void queryClient.invalidateQueries({ queryKey: reinforcementKeys.all });
  }
  void queryClient.invalidateQueries({ queryKey: ["library", "snapshot", userId] });
  void queryClient.invalidateQueries({ queryKey: ["home-data", userId] });
  for (const listId of [result?.area_list_id, result?.materialization_list_id]) {
    if (!listId) continue;
    void queryClient.invalidateQueries({ queryKey: ["flashcards", listId] });
    void queryClient.invalidateQueries({ queryKey: ["list", listId] });
  }
}

export function useReinforcement(userId: string | undefined, institutionId: string | null) {
  return useQuery({
    queryKey: userId
      ? reinforcementKeys.snapshot(userId, institutionId)
      : ["reinforcement", "snapshot", "anonymous", institutionId ?? "general"],
    queryFn: () => fetchReinforcementSnapshot(userId!, institutionId),
    enabled: Boolean(userId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useReinforcementMutation(
  userId: string | undefined,
  institutionId: string | null,
) {
  const queryClient = useQueryClient();
  const key = userId ? reinforcementKeys.snapshot(userId, institutionId) : null;
  return useMutation<ReinforcementMutationResult, Error, ReinforcementMutationInput, { previous?: ReinforcementSnapshot }>({
    mutationFn: setReinforcementPoint,
    onMutate: async (input) => {
      if (!userId || !key) throw new Error("Não autenticado");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReinforcementSnapshot>(key);
      const groupId = input.sourceGroupId ?? input.sourceCardId;
      if (previous) {
        queryClient.setQueryData<ReinforcementSnapshot>(key, (current) => {
          if (!current) return current;
          const matches = (item: ReinforcementItem) =>
            item.source_card_id === input.sourceCardId
            || item.source_group_uid === groupId
            || item.active_ids.includes(input.sourceCardId)
            || item.active_ids.includes(groupId);
          if (!input.enabled) {
            return { ...current, items: current.items.filter((item) => !matches(item)) };
          }
          if (current.items.some(matches)) return current;
          return {
            ...current,
            items: [...current.items, {
              id: `optimistic:${input.sourceCardId}`,
              source_card_id: input.sourceCardId,
              source_group_uid: groupId,
              source_list_id: null,
              materialization_list_id: null,
              materialization_group_id: null,
              term: "Salvando…",
              translation: "",
              layer_count: 1,
              active_ids: [input.sourceCardId, groupId],
            }],
          };
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (key && context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message || "Erro ao atualizar o Reforço.");
    },
    onSuccess: (result) => {
      toast.success(result.enabled ? "Adicionado ao Reforço" : "Removido do Reforço");
    },
    onSettled: (result) => {
      if (userId) invalidateReinforcementQueries(queryClient, userId, institutionId, result);
    },
  });
}
