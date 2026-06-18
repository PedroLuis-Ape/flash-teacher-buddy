import { describe, expect, it } from "vitest";
import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";
import {
  buildRetryExportPackage,
  buildSpecialExportBatches,
  buildSpecialPrompt,
  type StoredSpecialExportManifest,
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

describe("special export protocol v2", () => {
  it("creates versioned batches with stable short references", () => {
    const batches = buildSpecialExportBatches(
      [card(ID_A, "take"), card(ID_B, "leave")],
      1,
      () => "exp_test",
    );
    expect(batches).toHaveLength(2);
    expect(batches[0]).toMatchObject({
      format: "ape-special-cards",
      schema_version: 2,
      export_id: "exp_test_b01",
      card_count: 1,
    });
    expect(batches[0].cards[0].card_ref).toBe("CARD_001");
    expect(batches[0].cards[0]).not.toHaveProperty("list_id");
  });

  it("builds a strict prompt tied to the exported batch", () => {
    const batch = buildSpecialExportBatches([card(ID_A, "take")], 20, () => "exp_prompt")[0];
    const prompt = buildSpecialPrompt(batch);
    expect(prompt).toContain('"format": "ape-special-explanations"');
    expect(prompt).toContain('"export_id": "exp_prompt_b01"');
    expect(prompt).toContain("Responda SOMENTE com um único objeto JSON válido");
    expect(prompt).toContain(ID_A);
  });

  it("builds a retry batch containing only missing cards", () => {
    const batch = buildSpecialExportBatches(
      [card(ID_A, "take"), card(ID_B, "leave")],
      20,
      () => "exp_original",
    )[0];
    const manifest: StoredSpecialExportManifest = {
      ...batch,
      created_at: "2026-06-17T00:00:00Z",
      status: "partial",
    };
    const retry = buildRetryExportPackage(manifest, [ID_B], () => "exp_retry");
    expect(retry?.cards).toHaveLength(1);
    expect(retry?.cards[0].flashcard_id).toBe(ID_B);
  });
});
