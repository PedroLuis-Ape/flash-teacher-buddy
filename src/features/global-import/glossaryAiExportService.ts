import { supabase } from "@/integrations/supabase/client";
import type { GlossarySourceCard } from "./glossaryAiExport";

const LIST_CHUNK_SIZE = 100;
const PAGE_SIZE = 1000;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

export async function streamGlossarySourceCards(
  listIds: readonly string[],
  onBatch: (cards: GlossarySourceCard[], loadedCards: number) => void | Promise<void>,
): Promise<number> {
  const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
  if (uniqueListIds.length === 0) return 0;

  const seenIds = new Set<string>();
  let loadedCards = 0;

  for (const listChunk of chunks(uniqueListIds, LIST_CHUNK_SIZE)) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, list_id, term, translation")
        .in("list_id", listChunk)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const batch: GlossarySourceCard[] = [];
      for (const row of (data ?? []) as GlossarySourceCard[]) {
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        if (!row.term?.trim() && !row.translation?.trim()) continue;
        batch.push(row);
      }

      if (batch.length > 0) {
        loadedCards += batch.length;
        await onBatch(batch, loadedCards);
      }

      await yieldToBrowser();
      if ((data?.length ?? 0) < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return loadedCards;
}

export async function loadGlossarySourceCards(
  listIds: readonly string[],
  onProgress?: (loadedCards: number) => void,
): Promise<GlossarySourceCard[]> {
  const rows: GlossarySourceCard[] = [];
  await streamGlossarySourceCards(listIds, (batch, loadedCards) => {
    rows.push(...batch);
    onProgress?.(loadedCards);
  });
  return rows;
}
