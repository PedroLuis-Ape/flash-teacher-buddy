/**
 * Persistence helpers for layered cards.
 *
 * A "layered card" is just a normal flashcard row whose `parent_card_id`
 * points to another flashcard (the "principal"). The principal aggregates
 * meaning-layers; each layer is a real `flashcards` row and therefore inherits
 * the existing RLS, progress tracking and study-engine behaviour.
 *
 * This module exposes three operations:
 *   - createLayeredCard:  insert principal + N layers (used by importer).
 *   - mergeIntoLayers:    promote N existing cards into layers under a new
 *                         principal (used by FlashcardList → "Mesclar").
 *   - unmergeLayers:      detach all layers from a principal (used by editor).
 *
 * All operations are additive — they do NOT touch flashcards outside the
 * provided IDs and never delete user data.
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
  // 1) Create principal (aggregator). translation stays empty so it does not
  // pretend to be a single-meaning answer in study modes — it acts purely as
  // a label/folder for the layers.
  const { data: principal, error: pErr } = await supabase
    .from("flashcards")
    .insert({
      list_id: listId,
      user_id: userId,
      term: group.term,
      translation: group.layers[0]?.translation ?? "", // safe default
    })
    .select("id")
    .single();

  if (pErr || !principal) throw pErr ?? new Error("Falha ao criar card principal");

  // 2) Create one row per layer, linked to the principal.
  const layerRows = group.layers.map((L, i) => ({
    list_id: listId,
    user_id: userId,
    term: group.term,
    translation: L.translation,
    example_text: L.example ?? null,
    example_translation: L.exampleTranslation ?? null,
    context_tag: L.contextTag ?? null,
    short_explanation: L.shortExplanation ?? null,
    parent_card_id: principal.id,
    layer_index: i,
  }));

  if (layerRows.length > 0) {
    const { error: lErr } = await supabase.from("flashcards").insert(layerRows);
    if (lErr) throw lErr;
  }

  return { principalId: principal.id };
}

export interface MergeIntoLayersArgs {
  listId: string;
  userId: string;
  cardIds: string[];
  /** Title for the new principal card. */
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