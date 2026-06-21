import { describe, expect, it } from "vitest";
import { parseSpecialImportText, reconcileSpecialImport } from "./parser";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const manifest: import("./protocolPolicy").StoredSpecialExportManifest = {
  format: "ape-special-cards",
  schema_version: 2,
  export_id: "exp_test_b01",
  batch_index: 1,
  batch_count: 1,
  card_count: 2,
  created_at: "2026-06-17T00:00:00Z",
  status: "awaiting_import",
  cards: [
    { card_ref: "CARD_001", flashcard_id: A, term: "take", translation: "pegar", hint: null, context_tag: null, example_text: null, example_translation: null, is_layer: false, layer_number: null, list_title: null },
    { card_ref: "CARD_002", flashcard_id: B, term: "leave", translation: "deixar", hint: null, context_tag: null, example_text: null, example_translation: null, is_layer: false, layer_number: null, list_title: null },
  ],
};

describe("manifest reconciliation", () => {
  it("detects a duplicate and a missing card", () => {
    const parsed = parseSpecialImportText(JSON.stringify({
      export_id: manifest.export_id,
      items: [
        { card_ref: "CARD_001", flashcard_id: A, detailed_explanation: "Ok" },
        { card_ref: "CARD_001", flashcard_id: A, detailed_explanation: "Again" },
      ],
    }));
    const result = reconcileSpecialImport(parsed, manifest);
    expect(result.rows.map((row) => row.status)).toEqual(["valid", "duplicate"]);
    expect(result.missing_expected_ids).toEqual([B]);
  });
});
