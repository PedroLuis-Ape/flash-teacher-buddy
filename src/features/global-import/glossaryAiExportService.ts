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

export async function loadGlossarySourceCards(
  listIds: readonly string[],
  onProgress?: (loadedCards: number) => void,
): Promise<GlossarySourceCard[]> {
  const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
  if (uniqueListIds.length === 0) return [];

  const rows: GlossarySourceCard[] = [];
  const seenIds = new Set<string>();

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

      for (const row of (data ?? []) as GlossarySourceCard[]) {
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        if (!row.term?.trim() && !row.translation?.trim()) continue;
        rows.push(row);
      }

      onProgress?.(rows.length);
      if ((data?.length ?? 0) < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return rows;
}
