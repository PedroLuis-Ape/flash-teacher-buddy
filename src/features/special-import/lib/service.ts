import { supabase } from "@/integrations/supabase/client";
import { APPLY_BATCH, VALIDATE_LOOKUP_BATCH, runInBatches } from "./chunking";
import type { NormalizedSpecialImportItem, ReconciledSpecialImportRow } from "./parser";

export type ConflictMode = "replace" | "append" | "skip";
export interface ImportProgress { processed: number; total: number }
export interface DatabaseCardState { detailed_explanation: string | null }
export interface ApplyResult {
  flashcard_id: string;
  status: string;
  message?: string;
  explanation_updated?: boolean;
  removed_from_specials?: boolean;
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

  const batches = await runInBatches(
    ids,
    VALIDATE_LOOKUP_BATCH,
    async (batchIds) => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, detailed_explanation")
        .in("id", batchIds);
      if (error) throw error;
      return (data as Array<{ id: string; detailed_explanation: string | null }>) ?? [];
    },
    { onProgress: (value) => onProgress?.({ processed: value.processed, total: value.total }) },
  );
  batches.flat().forEach((row) => map.set(row.id, { detailed_explanation: row.detailed_explanation ?? null }));
  return map;
}

function extraExamples(item: NormalizedSpecialImportItem): string {
  if (!item.examples || item.examples.length <= 1) return "";
  const lines = item.examples.slice(1).map((example, index) => (
    `${index + 2}. ${example.en ?? ""}${example.pt ? ` — ${example.pt}` : ""}`
  ));
  return `\n\nExemplos adicionais:\n${lines.join("\n")}`;
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

  const remainingIds = new Set(((remaining as Array<{ flashcard_id: string }>) ?? [])
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
  conflictMode: ConflictMode,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ApplyResult[]> {
  const payload = rows.map(({ item, flashcardId }) => {
    const first = item.examples?.[0];
    return {
      flashcard_id: flashcardId,
      detailed_explanation: item.detailed_explanation + extraExamples(item),
      usage_notes: item.usage_notes ?? null,
      common_mistakes: item.common_mistakes ?? null,
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
        { p_items: batch, p_conflict_mode: conflictMode },
      );
      if (error) throw error;
      results.push(...((data?.results ?? []) as ApplyResult[]));
    },
    { onProgress: (value) => onProgress?.({ processed: value.processed, total: value.total }) },
  );
  return verifyAppliedItemsLeftTheQueue(results);
}
