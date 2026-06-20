import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  SmartCard,
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

function invertHint(hint: SmartWordHint): SmartWordHint {
  return { ...hint, side: hint.side === "A" ? "B" : "A" };
}

function invertPlayable<T extends SmartNormalCard | SmartLayer>(card: T): T {
  return {
    ...card,
    front: card.back,
    back: card.front,
    example: card.example_translation ?? null,
    example_translation: card.example ?? null,
    word_hints: card.word_hints?.map(invertHint),
  };
}

function invertGlossary(entry: SmartGlossaryEntry): SmartGlossaryEntry {
  return {
    ...entry,
    term: entry.translation,
    translation: entry.term,
    side: entry.side === "A" ? "B" : "A",
  };
}

function invertCard(card: SmartCard): SmartCard {
  if (card.type === "normal") return invertPlayable(card);
  return { ...card, layers: card.layers.map(invertPlayable) };
}

function effectiveList(list: SmartImportList, invert: boolean): SmartImportList {
  if (!invert) return list;
  return {
    ...list,
    front_language: list.back_language,
    back_language: list.front_language,
    primary_side: list.primary_side === "a" ? "b" : "a",
    label_a: list.label_b,
    label_b: list.label_a,
    glossary: list.glossary.map(invertGlossary),
    cards: list.cards.map(invertCard),
  };
}

function numberField(value: unknown, key: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" ? raw : Number(raw ?? 0) || 0;
}

export async function importSmartListIntoExistingList(
  options: SmartLocalImportOptions,
): Promise<SmartLocalImportReport> {
  const list = effectiveList(options.list, Boolean(options.invertSides));
  const total = list.cards.reduce(
    (sum, card) => sum + (card.type === "normal" ? 1 : card.layers.length),
    0,
  ) + list.glossary.length;

  options.onProgress?.(0, Math.max(total, 1), "Enviando importação transacional");

  const { data, error } = await (supabase.rpc as any)("import_smart_list_v2", {
    _list_id: options.listId,
    _payload: list as unknown as Json,
    _duplicate_policy: options.duplicatePolicy ?? "skip",
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("O banco não devolveu o relatório da importação.");
  }

  options.onProgress?.(Math.max(total, 1), Math.max(total, 1), "Importação concluída");

  return {
    cardsCreated: numberField(data, "cards_created"),
    cardsSkipped: numberField(data, "cards_skipped"),
    layeredGroupsCreated: numberField(data, "layered_groups_created"),
    glossaryCreated: numberField(data, "glossary_created"),
    glossaryUpdated: numberField(data, "glossary_updated"),
  };
}
