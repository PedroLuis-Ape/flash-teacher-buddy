import { supabase } from "@/integrations/supabase/client";
import type { GlossarySourceCard } from "./glossaryAiExport";

const LIST_CHUNK_SIZE = 100;
const PAGE_SIZE = 1000;

export interface GlossarySourceCardsPage {
  rows: GlossarySourceCard[];
  total: number;
  offset: number;
  nextOffset: number;
}

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

function isMissingRpc(error: unknown): boolean {
  const err = error as { message?: string; details?: string; hint?: string; code?: string } | null | undefined;
  const text = `${err?.message ?? ""} ${err?.details ?? ""} ${err?.hint ?? ""} ${err?.code ?? ""}`.toLowerCase();
  return text.includes("get_glossary_source_cards_page")
    || text.includes("could not find the function")
    || text.includes("pgrst202");
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

async function loadGlossarySourceCardsPageFallback(
  listIds: readonly string[],
  offset: number,
  limit: number,
): Promise<GlossarySourceCardsPage> {
  // Compatibility path used only until the Supabase migration/RPC is live.
  // It still limits browser work to one page, but the total can only be known
  // accurately after the RPC is available.
  const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
  if (uniqueListIds.length === 0) return { rows: [], total: 0, offset, nextOffset: offset };

  const firstChunk = uniqueListIds.slice(0, LIST_CHUNK_SIZE);
  const { data, error, count } = await supabase
    .from("flashcards")
    .select("id, list_id, term, translation", { count: "exact" })
    .in("list_id", firstChunk)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const rows = ((data ?? []) as GlossarySourceCard[])
    .filter((row) => row.term?.trim() || row.translation?.trim());

  return {
    rows,
    total: count ?? offset + rows.length,
    offset,
    nextOffset: offset + rows.length,
  };
}

export async function loadGlossarySourceCardsPage(
  listIds: readonly string[],
  offset = 0,
  limit = 250,
): Promise<GlossarySourceCardsPage> {
  const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
  if (uniqueListIds.length === 0) return { rows: [], total: 0, offset, nextOffset: offset };

  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const safeOffset = Math.max(0, offset);
  const { data, error } = await (supabase as any).rpc("get_glossary_source_cards_page", {
    p_list_ids: uniqueListIds,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });

  if (error) {
    if (isMissingRpc(error)) return loadGlossarySourceCardsPageFallback(uniqueListIds, safeOffset, safeLimit);
    throw error;
  }

  const rowsWithTotal = (data ?? []) as Array<GlossarySourceCard & { total_count?: number | string | null }>;
  const rows = rowsWithTotal.map(({ total_count: _totalCount, ...row }) => row);
  const total = Number(rowsWithTotal[0]?.total_count ?? safeOffset + rows.length);

  return {
    rows,
    total,
    offset: safeOffset,
    nextOffset: safeOffset + rows.length,
  };
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
