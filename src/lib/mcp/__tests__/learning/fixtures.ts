/** Fixtures de cards e bibliotecas usadas pelos testes do motor. */

import type { VocabularyCardRow } from "../../learning/types";

export function card(id: string, term: string, extra: Partial<VocabularyCardRow> = {}): VocabularyCardRow {
  return {
    id,
    term,
    translation: extra.translation ?? "",
    hint: extra.hint,
    example_text: extra.example_text,
    context_tag: extra.context_tag,
    list_id: extra.list_id ?? "aaaaaaaa-0001-4000-8000-000000000001",
    created_at: extra.created_at ?? "2026-09-13T12:00:00.000Z",
    ...extra,
  };
}

export function cardId(index: number): string {
  return "aaaaaaaa-0002-4000-8000-" + String(index).padStart(12, "0");
}

export function listId(index: number): string {
  return "10000000-0000-4000-8000-" + String(index).padStart(12, "0");
}

export function folderId(index: number): string {
  return "20000000-0000-4000-8000-" + String(index).padStart(12, "0");
}

export interface ScaleLibrary {
  rows: VocabularyCardRow[];
  folderByList: Record<string, string>;
}

/**
 * Biblioteca grande e realista: N listas, M cards, com cinco termos reais no
 * comeco (study, warehouse, run, look after, work) e o resto como volume.
 */
export function buildScaleLibrary(lists: number, cards: number): ScaleLibrary {
  const rows: VocabularyCardRow[] = [];
  const folderByList: Record<string, string> = {};
  for (let index = 0; index < lists; index += 1) {
    folderByList[listId(index)] = folderId(Math.floor(index / 10));
  }

  const seedTerms = ["study", "warehouse", "run", "look after", "work"];
  for (let index = 0; index < cards; index += 1) {
    const ownerList = listId(index % lists);
    const seed = seedTerms[index];
    rows.push(
      card(cardId(index), seed ?? "term" + String(index).padStart(7, "0"), {
        list_id: ownerList,
        translation: seed ? "t" + index : "volume",
        created_at: "2026-09-13T12:00:00." + String(index % 1000).padStart(3, "0") + "Z",
      }),
    );
  }
  return { rows, folderByList };
}
