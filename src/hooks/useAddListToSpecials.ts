import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildListSpecialPlan,
  chunkArray,
  type ListSpecialCandidate,
} from "@/features/special-import/lib/listSpecials";

const WRITE_CHUNK_SIZE = 200;
const READ_CHUNK_SIZE = 250;

export interface AddListToSpecialsVariables {
  listId: string;
  cards: ListSpecialCandidate[];
}

export interface AddListToSpecialsResult {
  success: true;
  eligible_count: number;
  already_special_count: number;
  inserted_count: number;
  standalone_count: number;
  layer_count: number;
  used_fallback: boolean;
}

function isMissingRpc(error: any): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

async function fallbackInsert(
  userId: string,
  listId: string,
  cards: ListSpecialCandidate[],
): Promise<AddListToSpecialsResult> {
  const plan = buildListSpecialPlan(cards);
  if (plan.eligibleCount === 0) {
    return {
      success: true,
      eligible_count: 0,
      already_special_count: 0,
      inserted_count: 0,
      standalone_count: 0,
      layer_count: 0,
      used_fallback: true,
    };
  }

  const existing = new Set<string>();
  for (const ids of chunkArray(plan.eligibleIds, READ_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("user_special_flashcards" as any)
      .select("flashcard_id")
      .eq("user_id", userId)
      .in("flashcard_id", ids);
    if (error) throw error;
    for (const row of (data as any[]) ?? []) existing.add(row.flashcard_id);
  }

  const missingIds = plan.eligibleIds.filter((id) => !existing.has(id));
  const insertedIds: string[] = [];

  try {
    for (const ids of chunkArray(missingIds, WRITE_CHUNK_SIZE)) {
      const rows = ids.map((flashcardId) => ({
        user_id: userId,
        flashcard_id: flashcardId,
        list_id: listId,
      }));

      const { data, error } = await (supabase
        .from("user_special_flashcards" as any) as any)
        .upsert(rows, {
          onConflict: "user_id,flashcard_id",
          ignoreDuplicates: true,
        })
        .select("flashcard_id");

      if (error) throw error;
      for (const row of (data as any[]) ?? []) insertedIds.push(row.flashcard_id);
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const ids of chunkArray(insertedIds, WRITE_CHUNK_SIZE)) {
      const { error: rollbackError } = await supabase
        .from("user_special_flashcards" as any)
        .delete()
        .eq("user_id", userId)
        .in("flashcard_id", ids);
      if (rollbackError) rollbackFailed = true;
    }

    if (rollbackFailed) {
      throw new Error("A operação falhou e parte do rollback também falhou. Reabra a Caixa de Especiais para conferir os itens.");
    }
    throw error;
  }

  return {
    success: true,
    eligible_count: plan.eligibleCount,
    already_special_count: plan.eligibleCount - insertedIds.length,
    inserted_count: insertedIds.length,
    standalone_count: plan.standaloneCount,
    layer_count: plan.layerCount,
    used_fallback: true,
  };
}

export function useAddListToSpecials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, cards }: AddListToSpecialsVariables): Promise<AddListToSpecialsResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const plan = buildListSpecialPlan(cards);
      const { data, error } = await (supabase as any).rpc("add_list_flashcards_to_specials", {
        p_list_id: listId,
      });

      if (!error) {
        const result = data as Partial<AddListToSpecialsResult> & { success?: boolean; message?: string; error?: string };
        if (!result?.success) throw new Error(result?.message || result?.error || "Não foi possível adicionar a lista aos especiais.");
        return {
          success: true,
          eligible_count: Number(result.eligible_count ?? plan.eligibleCount),
          already_special_count: Number(result.already_special_count ?? 0),
          inserted_count: Number(result.inserted_count ?? 0),
          standalone_count: Number(result.standalone_count ?? plan.standaloneCount),
          layer_count: Number(result.layer_count ?? plan.layerCount),
          used_fallback: false,
        };
      }

      if (!isMissingRpc(error)) throw error;
      return fallbackInsert(user.id, listId, cards);
    },
    onSuccess: (result) => {
      if (result.inserted_count === 0) {
        toast.info("Todos os cards desta lista já estavam nos especiais.");
      } else {
        const existingText = result.already_special_count > 0
          ? ` ${result.already_special_count} já estavam na caixa.`
          : "";
        toast.success(`💎 ${result.inserted_count} card(s) adicionados aos especiais.${existingText}`);
      }
    },
    onError: (error: any) => {
      console.error("[bulk-list-specials]", error);
      toast.error(error?.message || "Erro ao adicionar a lista aos especiais.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["special-flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["special-flashcards-count"] });
      queryClient.invalidateQueries({ queryKey: ["special-flashcards-details"] });
    },
  });
}
