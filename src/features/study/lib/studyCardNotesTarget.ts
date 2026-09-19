/**
 * Identidade canônica do card que está aberto agora no Study.
 *
 * Extraído do editor in-game para ser reutilizado pelas anotações de glossário:
 * o card visível pode ser uma materialização de Reforço/Revisão e a escrita
 * precisa sempre voltar para o card original do usuário.
 */
import { supabase } from "@/integrations/supabase/client";
import { readStudyResumePointer } from "./studyResumePointer";

export type RuntimeEditableCard = {
  id: string;
  user_id?: string | null;
  list_id?: string | null;
  parent_card_id?: string | null;
  layer_index?: number | null;
  term: string;
  translation: string;
  hint?: string | null;
  image_url_a?: string | null;
  image_url_b?: string | null;
  word_hints?: unknown;
  note_text?: string[] | null;
  short_explanation?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
};

export const EDITABLE_CARD_SELECT = [
  "id",
  "user_id",
  "list_id",
  "parent_card_id",
  "layer_index",
  "term",
  "translation",
  "hint",
  "image_url_a",
  "image_url_b",
  "word_hints",
  "note_text",
  "short_explanation",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
].join(",");

export function normalizeCardPath(pathname: string): string {
  return pathname.split("?")[0].replace(/\/+$/u, "");
}

export interface CurrentCardPointer {
  currentCardId: string;
  layerIndex: number | null;
}

/**
 * Só aceita o ponteiro quando ele pertence à rota aberta agora. Isso evita
 * anotar o card errado depois de navegar entre listas ou modos.
 */
export function readCurrentCardPointer(
  userId: string | undefined,
  pathname: string,
): CurrentCardPointer | null {
  if (!userId) return null;
  const pointer = readStudyResumePointer(userId);
  if (!pointer?.currentCardId) return null;
  const current = normalizeCardPath(pathname);
  const pointerPath = normalizeCardPath(pointer.path ?? "");
  if (!current || pointerPath !== current) return null;
  return { currentCardId: pointer.currentCardId, layerIndex: pointer.layerIndex ?? null };
}

export async function fetchEditableCard(cardId: string): Promise<RuntimeEditableCard> {
  const { data, error } = await (supabase as any)
    .from("flashcards")
    .select(EDITABLE_CARD_SELECT)
    .eq("id", cardId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Card atual não encontrado.");
  }

  return data as RuntimeEditableCard;
}

export async function resolveVisibleCard(
  cardId: string,
  layerIndex: number | null | undefined,
): Promise<RuntimeEditableCard> {
  const entry = await fetchEditableCard(cardId);
  if (!entry.parent_card_id || layerIndex == null || layerIndex <= 0) return entry;

  const { data, error } = await (supabase as any)
    .from("flashcards")
    .select(EDITABLE_CARD_SELECT)
    .eq("parent_card_id", entry.parent_card_id)
    .is("deleted_at", null)
    .order("layer_index", { ascending: true });

  if (error) throw error;
  const layers = (data ?? []) as RuntimeEditableCard[];
  return layers[layerIndex] ?? entry;
}

export async function resolveMatchingSourceLayer(
  sourceCardId: string,
  materializedCard: RuntimeEditableCard,
): Promise<RuntimeEditableCard> {
  const sourceCard = await fetchEditableCard(sourceCardId);
  if (!materializedCard.parent_card_id) return sourceCard;

  const sourceParentId = sourceCard.parent_card_id ?? sourceCard.id;
  const { data, error } = await (supabase as any)
    .from("flashcards")
    .select(EDITABLE_CARD_SELECT)
    .eq("parent_card_id", sourceParentId)
    .is("deleted_at", null)
    .order("layer_index", { ascending: true });

  if (error) throw error;
  const sourceLayers = (data ?? []) as RuntimeEditableCard[];
  if (materializedCard.layer_index != null) {
    const exactLayer = sourceLayers.find((card) => card.layer_index === materializedCard.layer_index);
    if (exactLayer) return exactLayer;
  }

  return sourceCard;
}

/**
 * Materialização de Reforço → card original. Nunca escreve no clone.
 */
export async function resolveOriginalCardForNotes(
  userId: string,
  materializedCard: RuntimeEditableCard,
): Promise<RuntimeEditableCard> {
  const materializationGroupId = materializedCard.parent_card_id ?? materializedCard.id;

  const { data: reinforcementPoint, error: reinforcementError } = await (supabase as any)
    .from("user_reinforcement_points")
    .select("source_card_id")
    .eq("user_id", userId)
    .eq("materialization_group_id", materializationGroupId)
    .eq("is_active", true)
    .maybeSingle();

  if (reinforcementError) throw reinforcementError;
  if (reinforcementPoint?.source_card_id) {
    return resolveMatchingSourceLayer(reinforcementPoint.source_card_id, materializedCard);
  }

  // Compatibilidade com materializações históricas de Pontos de atenção.
  const { data: attentionPoint, error: attentionError } = await (supabase as any)
    .from("user_special_flashcards")
    .select("flashcard_id")
    .eq("user_id", userId)
    .eq("materialization_group_id", materializationGroupId)
    .eq("is_active", true)
    .maybeSingle();

  if (attentionError) throw attentionError;
  if (attentionPoint?.flashcard_id) {
    return resolveMatchingSourceLayer(attentionPoint.flashcard_id, materializedCard);
  }

  if (!materializedCard.list_id) return materializedCard;

  const { data: list, error: listError } = await (supabase as any)
    .from("lists")
    .select("system_kind")
    .eq("id", materializedCard.list_id)
    .maybeSingle();

  if (listError) throw listError;
  if (list?.system_kind && list.system_kind !== "user") {
    throw new Error("Não foi possível localizar o card original desta revisão.");
  }

  return materializedCard;
}

export interface ResolvedCurrentCard {
  visibleCard: RuntimeEditableCard;
  sourceCard: RuntimeEditableCard;
}

export async function resolveCurrentSourceCard(
  userId: string,
  pathname: string,
): Promise<ResolvedCurrentCard> {
  const pointer = readCurrentCardPointer(userId, pathname);
  if (!pointer) {
    throw new Error("Não foi possível identificar com segurança o card atual.");
  }
  const visibleCard = await resolveVisibleCard(pointer.currentCardId, pointer.layerIndex);
  const sourceCard = await resolveOriginalCardForNotes(userId, visibleCard);
  return { visibleCard, sourceCard };
}

export function isOwnedByUser(card: RuntimeEditableCard, userId: string | undefined): boolean {
  return Boolean(userId && card.user_id && card.user_id === userId);
}

export const READ_ONLY_CARD_MESSAGE =
  "Este material é somente leitura: não é possível anotar aqui.";

