import { describe, expect, it } from "vitest";
import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";
import {
  buildSpecialExportBatches,
  buildSpecialPrompt,
  loadSpecialExportManifests,
  saveSpecialExportManifest,
} from "./protocol";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function card(id: string, term: string): SpecialFlashcardDetail {
  return {
    id: `queue-${id}`,
    flashcard_id: id,
    created_at: "2026-06-17T00:00:00Z",
    term,
    translation: `tradução de ${term}`,
    hint: null,
    context_tag: "ação",
    example_text: null,
    example_translation: null,
    layer_index: null,
    parent_card_id: null,
    list_id: "list-1",
    list_title: "Lista",
  };
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("special replacement policy", () => {
  it("asks the AI to identify the key expression inside a sentence", () => {
    const batch = buildSpecialExportBatches(
      [card(ID_A, "The city announces sweeping new curbs")],
      20,
      () => "exp_prompt",
    )[0];
    const prompt = buildSpecialPrompt(batch);
    expect(prompt).toContain("Expressão-chave:");
    expect(prompt).toContain("sweeping new curbs");
  });

  it("supersedes the same card in every older export", () => {
    const storage = memoryStorage();
    const oldBatch = buildSpecialExportBatches(
      [card(ID_A, "old A"), card(ID_B, "old B")],
      20,
      () => "exp_old",
    )[0];
    const newBatch = buildSpecialExportBatches(
      [card(ID_A, "new A")],
      20,
      () => "exp_new",
    )[0];

    saveSpecialExportManifest(oldBatch, storage);
    saveSpecialExportManifest(newBatch, storage);

    const manifests = loadSpecialExportManifests(storage);
    expect(manifests[0].export_id).toBe("exp_new_b01");
    expect(manifests[0].cards.map((item) => item.flashcard_id)).toEqual([ID_A]);
    const old = manifests.find((item) => item.export_id === "exp_old_b01");
    expect(old?.cards.map((item) => item.flashcard_id)).toEqual([ID_B]);
    expect(old?.card_count).toBe(1);
  });
});
