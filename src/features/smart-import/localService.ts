import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  SmartGlossaryEntry,
  SmartImportList,
  SmartLayer,
  SmartNormalCard,
  SmartWordHint,
} from "./schema";

export type SmartDuplicatePolicy = "skip" | "copy" | "error";

export interface SmartLocalImportOptions {
  listId: string;
  list: SmartImportList;
  invertSides?: boolean;
  duplicatePolicy?: SmartDuplicatePolicy;
  onProgress?: (completed: number, total: number, label: string) => void;
}

export interface SmartLocalImportReport {
  cardsCreated: number;
  cardsSkipped: number;
  layeredGroupsCreated: number;
  glossaryCreated: number;
  glossaryUpdated: number;
}

const normalizedKey = (a: string, b: string) => `${a.trim().toLocaleLowerCase()}\u0000${b.trim().toLocaleLowerCase()}`;

function invertHint(hint: SmartWordHint): SmartWordHint {
  return { ...hint, side: hint.side === "A" ? "B" : "A" };
}

function effectiveCard(card: SmartNormalCard | SmartLayer, invert: boolean): SmartNormalCard | SmartLayer {
  if (!invert) return card;
  return {
    ...card,
    front: card.back,
    back: card.front,
    example: card.example_translation ?? null,
    example_translation: card.example ?? null,
    word_hints: card.word_hints?.map(invertHint),
  };
}

function effectiveGlossary(entry: SmartGlossaryEntry, invert: boolean): SmartGlossaryEntry {
  if (!invert) return entry;
  return {
    ...entry,
    term: entry.translation,
    translation: entry.term,
    side: entry.side === "A" ? "B" : "A",
  };
}

function wordHintsForDb(hints: SmartWordHint[] | undefined): Json {
  return (hints ?? []).map((hint) => ({
    text: hint.text,
    translation: hint.translation,
    note: hint.note ?? undefined,
    side: hint.side,
    startIndex: hint.start_index,
    endIndex: hint.end_index,
  })) as Json;
}

function cardRow(card: SmartNormalCard | SmartLayer, listId: string, userId: string, parentCardId?: string, layerIndex?: number) {
  const observation = card.short_observation ? [card.short_observation] : [];
  return {
    list_id: listId,
    user_id: userId,
    term: card.front,
    translation: card.back,
    hint: card.hint ?? null,
    accepted_answers_en: observation,
    accepted_answers_pt: [],
    example_text: card.example ?? null,
    example_translation: card.example_translation ?? null,
    detailed_explanation: card.detailed_explanation ?? null,
    usage_notes: card.usage_notes ?? null,
    common_mistakes: card.common_mistakes ?? null,
    context_tag: card.context_tag ?? null,
    word_hints: wordHintsForDb(card.word_hints),
    parent_card_id: parentCardId ?? null,
    layer_index: layerIndex ?? null,
  };
}

export async function importSmartListIntoExistingList(options: SmartLocalImportOptions): Promise<SmartLocalImportReport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar logado.");

  const invert = Boolean(options.invertSides);
  const duplicatePolicy = options.duplicatePolicy ?? "skip";
  const report: SmartLocalImportReport = {
    cardsCreated: 0,
    cardsSkipped: 0,
    layeredGroupsCreated: 0,
    glossaryCreated: 0,
    glossaryUpdated: 0,
  };

  const total = options.list.cards.reduce((sum, card) => sum + (card.type === "normal" ? 1 : card.layers.length), 0)
    + options.list.glossary.length;
  let completed = 0;
  const progress = (label: string) => options.onProgress?.(completed, Math.max(total, 1), label);

  const [{ data: existingCards, error: cardsError }, { data: existingGlossary, error: glossaryError }] = await Promise.all([
    supabase.from("flashcards").select("id, term, translation").eq("list_id", options.listId).is("deleted_at", null),
    supabase.from("list_glossary").select("id, original_text, translated_text, side, note, is_active").eq("list_id", options.listId),
  ]);
  if (cardsError) throw cardsError;
  if (glossaryError) throw glossaryError;

  const existingCardKeys = new Map((existingCards ?? []).map((card) => [normalizedKey(card.term, card.translation), card.id]));
  const existingGlossaryMap = new Map((existingGlossary ?? []).map((entry) => [
    `${entry.side}|${normalizedKey(entry.original_text, entry.translated_text)}`,
    entry,
  ]));

  for (const rawGlossary of options.list.glossary) {
    const entry = effectiveGlossary(rawGlossary, invert);
    const key = `${entry.side}|${normalizedKey(entry.term, entry.translation)}`;
    const existing = existingGlossaryMap.get(key);
    if (existing) {
      const nextNote = entry.note ?? null;
      if (existing.note !== nextNote || existing.is_active !== entry.active) {
        const { error } = await supabase.from("list_glossary").update({ note: nextNote, is_active: entry.active }).eq("id", existing.id);
        if (error) throw error;
        report.glossaryUpdated += 1;
      }
    } else {
      const { error } = await supabase.from("list_glossary").insert({
        list_id: options.listId,
        original_text: entry.term,
        translated_text: entry.translation,
        note: entry.note ?? null,
        side: entry.side,
        is_active: entry.active,
      });
      if (error) throw error;
      report.glossaryCreated += 1;
    }
    completed += 1;
    progress("Importando glossário");
  }

  const insertNormal = async (rawCard: SmartNormalCard | SmartLayer, parentCardId?: string, layerIndex?: number) => {
    const card = effectiveCard(rawCard, invert);
    const key = normalizedKey(card.front, card.back);
    const duplicateId = existingCardKeys.get(key);
    if (duplicateId && duplicatePolicy === "error") throw new Error(`Card duplicado: ${card.front} / ${card.back}`);
    if (duplicateId && duplicatePolicy === "skip") {
      report.cardsSkipped += 1;
      completed += 1;
      progress("Ignorando duplicados");
      return duplicateId;
    }
    const { data, error } = await supabase.from("flashcards").insert(cardRow(card, options.listId, user.id, parentCardId, layerIndex)).select("id").single();
    if (error) throw error;
    if (!data?.id) throw new Error("O banco não retornou o ID do card criado.");
    existingCardKeys.set(key, data.id);
    report.cardsCreated += 1;
    completed += 1;
    progress("Importando cards");
    return data.id;
  };

  for (const card of options.list.cards) {
    if (card.type === "normal") {
      await insertNormal(card);
      continue;
    }

    const effectiveLayers = card.layers.map((layer) => effectiveCard(layer, invert));
    const firstLayer = effectiveLayers[0];
    if (!firstLayer) continue;
    const { data: principal, error: principalError } = await supabase.from("flashcards").insert({
      list_id: options.listId,
      user_id: user.id,
      term: card.group_title,
      translation: firstLayer.back,
      context_tag: card.group_title,
    }).select("id").single();
    if (principalError) throw principalError;
    if (!principal?.id) throw new Error("Falha ao criar o grupo de cards.");
    report.layeredGroupsCreated += 1;

    for (let index = 0; index < card.layers.length; index += 1) {
      await insertNormal(card.layers[index], principal.id, index);
    }
  }

  return report;
}
