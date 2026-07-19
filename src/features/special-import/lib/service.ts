import { supabase } from "@/integrations/supabase/client";
import { APPLY_BATCH, VALIDATE_LOOKUP_BATCH, runInBatches } from "./chunking";
import type { NormalizedSpecialImportItem, ReconciledSpecialImportRow } from "./parser";
import {
  hashSpecialSource,
  type SpecialV3CommonMistake,
  type SpecialV3SourceSnapshot,
} from "./v3Protocol";

export interface ImportProgress { processed: number; total: number }
export interface DatabaseCardState {
  detailed_explanation: string | null;
  source_hash: string;
  special_item_id: string | null;
}
export interface ApplyResult {
  flashcard_id: string;
  status: string;
  message?: string;
  explanation_updated?: boolean;
  removed_from_specials?: boolean;
}

interface CurrentCardRow {
  id: string;
  term: string;
  translation: string;
  hint: string | null;
  context_tag: string | null;
  example_text: string | null;
  example_translation: string | null;
  layer_index: number | null;
  parent_card_id: string | null;
  list_id: string | null;
  detailed_explanation: string | null;
}

interface CurrentSpecialRow {
  id: string;
  flashcard_id: string;
  focus_text?: string | null;
  focus_tag?: string | null;
  focus_note?: string | null;
  notes?: string | null;
}

function isMissingSpecialFocusColumns(error: unknown): boolean {
  const value = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  const text = `${value?.message ?? ""} ${value?.details ?? ""} ${value?.hint ?? ""} ${value?.code ?? ""}`.toLowerCase();
  return ["focus_text", "focus_tag", "focus_note"].some((column) => text.includes(column));
}

async function loadCurrentSpecialRows(
  userId: string | undefined,
  flashcardIds: string[],
): Promise<CurrentSpecialRow[]> {
  if (!userId || flashcardIds.length === 0) return [];

  const enhanced = await supabase
    .from("user_special_flashcards" as any)
    .select("id, flashcard_id, focus_text, focus_tag, focus_note, notes")
    .eq("user_id", userId)
    .in("flashcard_id", flashcardIds);

  if (!enhanced.error) return (enhanced.data as unknown as CurrentSpecialRow[]) ?? [];
  if (!isMissingSpecialFocusColumns(enhanced.error)) throw enhanced.error;

  const legacy = await supabase
    .from("user_special_flashcards" as any)
    .select("id, flashcard_id, notes")
    .eq("user_id", userId)
    .in("flashcard_id", flashcardIds);
  if (legacy.error) throw legacy.error;
  return (legacy.data as unknown as CurrentSpecialRow[]) ?? [];
}

function currentSourceSnapshot(card: CurrentCardRow, special?: CurrentSpecialRow): SpecialV3SourceSnapshot {
  return {
    term: card.term,
    translation: card.translation,
    hint: card.hint ?? null,
    context_tag: card.context_tag ?? null,
    example_text: card.example_text ?? null,
    example_translation: card.example_translation ?? null,
    layer_index: card.layer_index ?? null,
    parent_card_id: card.parent_card_id ?? null,
    list_id: card.list_id ?? null,
    focus_text: special?.focus_text?.trim() || null,
    focus_tag: special?.focus_tag?.trim() || null,
    focus_note: special?.focus_note?.trim() || special?.notes?.trim() || null,
  };
}

export async function lookupImportCards(
  rows: readonly ReconciledSpecialImportRow[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<Map<string, DatabaseCardState>> {
  const ids = Array.from(new Set(rows
    .filter((row) => row.status === "valid" && row.resolved_flashcard_id)
    .map((row) => row.resolved_flashcard_id!)));
  const map = new Map<string, DatabaseCardState>();
  if (ids.length === 0) return map;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  const batches = await runInBatches(
    ids,
    VALIDATE_LOOKUP_BATCH,
    async (batchIds) => {
      const [cardResult, specialRows] = await Promise.all([
        supabase
          .from("flashcards")
          .select("id, term, translation, hint, context_tag, example_text, example_translation, layer_index, parent_card_id, list_id, detailed_explanation")
          .in("id", batchIds)
          .is("deleted_at", null),
        loadCurrentSpecialRows(userId, batchIds),
      ]);
      if (cardResult.error) throw cardResult.error;
      return {
        cards: (cardResult.data as CurrentCardRow[]) ?? [],
        specials: specialRows,
      };
    },
    { onProgress: (value) => onProgress?.({ processed: value.processed, total: value.total }) },
  );

  batches.forEach(({ cards, specials }) => {
    const specialByCardId = new Map(specials.map((row) => [row.flashcard_id, row]));
    cards.forEach((card) => {
      const special = specialByCardId.get(card.id);
      map.set(card.id, {
        detailed_explanation: card.detailed_explanation ?? null,
        source_hash: hashSpecialSource(currentSourceSnapshot(card, special)),
        special_item_id: special?.id ?? null,
      });
    });
  });
  return map;
}

function extraExamples(item: NormalizedSpecialImportItem): string {
  if (!item.examples || item.examples.length <= 1) return "";
  const lines = item.examples.slice(1).map((example, index) => (
    `${index + 2}. ${example.en ?? ""}${example.pt ? ` — ${example.pt}` : ""}`
  ));
  return `\n\nExemplos adicionais:\n${lines.join("\n")}`;
}

function usageNotesText(item: NormalizedSpecialImportItem): string | null {
  const list = (item as NormalizedSpecialImportItem & { usage_notes_list?: string[] }).usage_notes_list;
  if (Array.isArray(list)) {
    const values = list.map((value) => value.trim()).filter(Boolean);
    return values.length ? values.map((value) => `• ${value}`).join("\n") : null;
  }
  return item.usage_notes?.trim() || null;
}

function commonMistakesText(item: NormalizedSpecialImportItem): string | null {
  const list = (item as NormalizedSpecialImportItem & {
    common_mistakes_list?: SpecialV3CommonMistake[];
  }).common_mistakes_list;
  if (Array.isArray(list)) {
    const values = list.filter((value) => value?.mistake && value?.correction && value?.explanation);
    return values.length
      ? values.map((value, index) => (
          `${index + 1}. Erro: ${value.mistake}\nCorreção: ${value.correction}\nExplicação: ${value.explanation}`
        )).join("\n\n")
      : null;
  }
  return item.common_mistakes?.trim() || null;
}

async function verifyAppliedItemsLeftTheQueue(results: ApplyResult[]): Promise<ApplyResult[]> {
  const appliedIds = Array.from(new Set(
    results.filter((result) => result.status === "applied").map((result) => result.flashcard_id),
  ));
  if (appliedIds.length === 0) return results;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return results.map((result) => result.status === "applied" ? {
      ...result,
      status: "error",
      explanation_updated: true,
      removed_from_specials: false,
      message: "A explicação foi aplicada, mas não foi possível confirmar a remoção dos Especiais.",
    } : result);
  }

  const { error: cleanupError } = await supabase
    .from("user_special_flashcards" as any)
    .delete()
    .eq("user_id", user.id)
    .in("flashcard_id", appliedIds);

  const { data: remaining, error: verifyError } = await supabase
    .from("user_special_flashcards" as any)
    .select("flashcard_id")
    .eq("user_id", user.id)
    .in("flashcard_id", appliedIds);

  if (cleanupError || verifyError) {
    return results.map((result) => result.status === "applied" ? {
      ...result,
      status: "error",
      explanation_updated: true,
      removed_from_specials: false,
      message: cleanupError?.message || verifyError?.message || "Falha ao confirmar a remoção dos Especiais.",
    } : result);
  }

  const remainingIds = new Set(((remaining as unknown as Array<{ flashcard_id: string }>) ?? [])
    .map((row) => row.flashcard_id));

  return results.map((result) => {
    if (result.status !== "applied") return result;
    const removed = !remainingIds.has(result.flashcard_id);
    return removed ? {
      ...result,
      explanation_updated: result.explanation_updated ?? true,
      removed_from_specials: true,
    } : {
      ...result,
      status: "error",
      explanation_updated: true,
      removed_from_specials: false,
      message: "A explicação foi aplicada, mas o card continuou na fila de Especiais.",
    };
  });
}

export async function applyImportRows(
  rows: readonly { item: NormalizedSpecialImportItem; flashcardId: string }[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<ApplyResult[]> {
  const payload = rows.map(({ item, flashcardId }) => {
    const first = item.examples?.[0];
    return {
      flashcard_id: flashcardId,
      detailed_explanation: item.detailed_explanation + extraExamples(item),
      usage_notes: usageNotesText(item),
      common_mistakes: commonMistakesText(item),
      example_text: first?.en ?? item.example_text ?? null,
      example_translation: first?.pt ?? item.example_translation ?? null,
    };
  });
  const results: ApplyResult[] = [];
  await runInBatches(
    payload,
    APPLY_BATCH,
    async (batch) => {
      const { data, error } = await (supabase as any).rpc(
        "apply_special_flashcard_explanations",
        { p_items: batch, p_conflict_mode: "replace" },
      );
      if (error) throw error;
      results.push(...((data?.results ?? []) as ApplyResult[]));
    },
    { onProgress: (value) => onProgress?.({ processed: value.processed, total: value.total }) },
  );
  return verifyAppliedItemsLeftTheQueue(results);
}
