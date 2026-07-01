/**
 * Persistence helpers for layered cards.
 *
 * A layered card uses one principal row plus two or more child rows linked by
 * parent_card_id. Creation is delegated to the same transactional database
 * function used by the Super Importer, so a partial group is never persisted.
 */

import { supabase } from "@/integrations/supabase/client";
import type { LayeredGroup } from "./layeredImport";

export interface CreateLayeredCardArgs {
  listId: string;
  userId: string;
  group: LayeredGroup;
}

export async function createLayeredCard({
  listId,
  userId,
  group,
}: CreateLayeredCardArgs): Promise<{ principalId: string }> {
  if (group.layers.length < 2) {
    throw new Error("Um grupo em camadas precisa ter pelo menos 2 camadas.");
  }

  const card = {
    type: "layered",
    group_title: group.term,
    layers: group.layers.map((layer) => ({
      front: layer.term ?? group.term,
      back: layer.translation,
      example: layer.example,
      example_translation: layer.exampleTranslation,
      context_tag: layer.contextTag,
      short_observation: layer.shortExplanation,
    })),
  };

  const { data, error } = await (supabase as any).rpc("import_layered_group_v2", {
    _uid: userId,
    _list_id: listId,
    _card: card,
    _card_conflict: "copy",
    _batch_id: null,
    _card_path: "$.manual-layered-card",
  });

  if (error) throw error;

  const result = data as {
    principal_id?: string;
    layered_groups_created?: number;
  } | null;
  if (!result?.principal_id || result.layered_groups_created !== 1) {
    throw new Error("Falha ao criar o grupo em camadas.");
  }

  return { principalId: result.principal_id };
}

export interface MergeIntoLayersArgs {
  listId: string;
  userId: string;
  cardIds: string[];
  title: string;
}

export async function mergeIntoLayers({
  listId,
  cardIds,
  title,
}: MergeIntoLayersArgs): Promise<{ principalId: string }> {
  if (cardIds.length < 2) throw new Error("Selecione pelo menos 2 cards para mesclar");

  const { data, error } = await (supabase as any).rpc("merge_cards_into_layers", {
    _list_id: listId,
    _card_ids: cardIds,
    _title: title,
  });

  if (error) throw error;

  const result = data as { success?: boolean; principal_id?: string; message?: string } | null;
  if (!result?.success || !result.principal_id) {
    throw new Error(result?.message || "Erro ao mesclar cards");
  }

  return { principalId: result.principal_id };
}

export async function unmergeLayers(principalId: string): Promise<void> {
  const { data, error } = await (supabase as any).rpc("unmerge_layered_card", {
    _principal_id: principalId,
  });

  if (error) throw error;

  const result = data as { success?: boolean; message?: string } | null;
  if (!result?.success) {
    throw new Error(result?.message || "Erro ao separar camadas");
  }
}
