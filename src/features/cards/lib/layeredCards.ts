import { supabase } from "@/integrations/supabase/client";
import type { LayeredGroup } from "./layeredImport";
import {
  normalizeLayeredCardDrafts,
  validateLayeredCardDrafts,
  type LayeredCardDraft,
} from "./layeredCardDraft";

export interface SaveLayeredCardGroupArgs {
  principalId?: string | null;
  listId: string;
  title: string;
  layers: LayeredCardDraft[];
}

export interface SaveLayeredCardGroupResult {
  principalId: string;
  layerIds: string[];
}

function layeredRpcError(error: unknown): Error {
  const input = error as { code?: unknown; message?: unknown } | null;
  const code = typeof input?.code === "string" ? input.code : "";
  const message = typeof input?.message === "string" ? input.message : "";
  if (code === "PGRST202" || message.toLowerCase().includes("save_layered_card_group_v2")) {
    return new Error(
      "O banco conectado ainda não recebeu a atualização atômica das camadas. "
      + "Aplique a migration 20260712223000_atomic_layered_card_groups.sql.",
    );
  }
  return error instanceof Error ? error : new Error(message || "Não foi possível salvar as camadas.");
}

export async function saveLayeredCardGroup({
  principalId = null,
  listId,
  title,
  layers,
}: SaveLayeredCardGroupArgs): Promise<SaveLayeredCardGroupResult> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Defina um título para o card em camadas.");

  const normalizedLayers = normalizeLayeredCardDrafts(layers);
  const errors = validateLayeredCardDrafts(normalizedLayers);
  if (errors.length > 0) throw new Error(errors[0]);

  const payload = normalizedLayers.map((layer) => ({
    ...(layer.id ? { id: layer.id } : {}),
    front: layer.front,
    back: layer.back,
    example: layer.example ?? null,
    example_translation: layer.exampleTranslation ?? null,
  }));

  const { data, error } = await (supabase as any).rpc("save_layered_card_group_v2", {
    _principal_id: principalId,
    _list_id: listId,
    _title: normalizedTitle,
    _layers: payload,
  });

  if (error) throw layeredRpcError(error);
  const result = data as {
    success?: boolean;
    principal_id?: string;
    layer_ids?: string[];
  } | null;
  if (!result?.success || !result.principal_id) {
    throw new Error("O banco não confirmou o salvamento das camadas.");
  }

  return {
    principalId: result.principal_id,
    layerIds: Array.isArray(result.layer_ids) ? result.layer_ids : [],
  };
}

export interface CreateLayeredCardArgs {
  listId: string;
  userId: string;
  group: LayeredGroup;
}

export async function createLayeredCard({
  listId,
  userId: _userId,
  group,
}: CreateLayeredCardArgs): Promise<{ principalId: string }> {
  void _userId;
  const result = await saveLayeredCardGroup({
    listId,
    title: group.term,
    layers: group.layers.map((layer) => ({
      front: layer.term ?? group.term,
      back: layer.translation,
      example: layer.example ?? null,
      exampleTranslation: layer.exampleTranslation ?? null,
    })),
  });
  return { principalId: result.principalId };
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
