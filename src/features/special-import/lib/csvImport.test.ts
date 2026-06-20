import { describe, expect, it } from "vitest";
import { parseSpecialImportInput, parseSpecialCsvText } from "./csvImport";
import { reconcileSpecialImport } from "./parser";
import { buildSpecialCsvExport, buildSpecialCsvPrompt } from "./csvProtocol";
import {
  SPECIAL_CSV_FORMAT,
  SPECIAL_CSV_HEADER_LINE,
  SPECIAL_CSV_SCHEMA_VERSION,
  serializeSpecialCsvRecord,
  type SpecialCsvRecord,
} from "./csvContract";
import type { SpecialExportPackage, StoredSpecialExportManifest } from "./protocol";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const batch: SpecialExportPackage = {
  format: "ape-special-cards",
  schema_version: 2,
  export_id: "exp_csv_test_b01",
  batch_index: 1,
  batch_count: 1,
  card_count: 2,
  cards: [
    { card_ref: "CARD_001", flashcard_id: A, term: "take", translation: "pegar", hint: null, context_tag: null, example_text: null, example_translation: null, is_layer: false, layer_number: null, list_title: "Verbos" },
    { card_ref: "CARD_002", flashcard_id: B, term: "leave", translation: "deixar", hint: null, context_tag: null, example_text: null, example_translation: null, is_layer: false, layer_number: null, list_title: "Verbos" },
  ],
};

const manifest: StoredSpecialExportManifest = {
  ...batch,
  created_at: "2026-06-20T00:00:00.000Z",
  status: "awaiting_import",
};

function completedRecord(overrides: Partial<SpecialCsvRecord> = {}): SpecialCsvRecord {
  return {
    format: SPECIAL_CSV_FORMAT,
    schema_version: String(SPECIAL_CSV_SCHEMA_VERSION),
    export_id: batch.export_id,
    card_ref: "CARD_001",
    flashcard_id: A,
    term: "take",
    translation: "pegar",
    detailed_explanation: "Explicação completa.",
    usage_notes: "Uso cotidiano.",
    common_mistakes: "Não confundir com bring.",
    example_1_en: "Take this book.",
    example_1_pt: "Pegue este livro.",
    example_2_en: "I take the bus.",
    example_2_pt: "Eu pego o ônibus.",
    ...overrides,
  };
}

describe("special CSV contract", () => {
  it("exports the official header and one row per card", () => {
    const csv = buildSpecialCsvExport(batch);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(SPECIAL_CSV_HEADER_LINE);
    expect(lines).toHaveLength(3);
    expect(csv).toContain(batch.export_id);
  });

  it("builds a prompt tied to the batch", () => {
    const prompt = buildSpecialCsvPrompt(batch);
    expect(prompt).toContain(batch.export_id);
    expect(prompt).toContain(String(batch.card_count));
    expect(prompt).toContain(SPECIAL_CSV_FORMAT);
  });

  it("parses commas, quotes, multiline fields and UTF-8 BOM", () => {
    const explanation = 'Explicação, com "aspas"\ne uma segunda linha.';
    const csv = `\uFEFF${SPECIAL_CSV_HEADER_LINE}\r\n${serializeSpecialCsvRecord(completedRecord({ detailed_explanation: explanation }))}`;
    const parsed = parseSpecialCsvText(csv);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].detailed_explanation).toBe(explanation);
    expect(parsed.items[0].examples).toHaveLength(2);
  });

  it("accepts CSV inside an accidental code fence", () => {
    const csv = `${SPECIAL_CSV_HEADER_LINE}\n${serializeSpecialCsvRecord(completedRecord())}`;
    const parsed = parseSpecialImportInput(`\`\`\`csv\n${csv}\n\`\`\``);
    expect(parsed.export_id).toBe(batch.export_id);
    expect(parsed.items[0].flashcard_id).toBe(A);
  });

  it("rejects an altered header", () => {
    expect(() => parseSpecialCsvText('"flashcard_id","detailed_explanation"\n"x","y"'))
      .toThrow(/cabeçalho csv inválido/i);
  });

  it("marks an empty explanation as invalid", () => {
    const csv = `${SPECIAL_CSV_HEADER_LINE}\n${serializeSpecialCsvRecord(completedRecord({ detailed_explanation: "" }))}`;
    const parsed = parseSpecialCsvText(csv);
    expect(parsed.items).toHaveLength(0);
    expect(parsed.invalid[0].reason).toMatch(/detailed_explanation/i);
  });

  it("detects duplicate IDs and missing cards through the manifest", () => {
    const first = serializeSpecialCsvRecord(completedRecord());
    const duplicate = serializeSpecialCsvRecord(completedRecord({ detailed_explanation: "Outra explicação." }));
    const parsed = parseSpecialCsvText(`${SPECIAL_CSV_HEADER_LINE}\n${first}\n${duplicate}`);
    const reconciled = reconcileSpecialImport(parsed, manifest);
    expect(reconciled.rows.map((row) => row.status)).toEqual(["valid", "duplicate"]);
    expect(reconciled.missing_expected_ids).toEqual([B]);
  });

  it("rejects a row whose export id differs from the batch", () => {
    const first = serializeSpecialCsvRecord(completedRecord());
    const second = serializeSpecialCsvRecord(completedRecord({
      card_ref: "CARD_002",
      flashcard_id: B,
      export_id: "exp_changed",
    }));
    const parsed = parseSpecialCsvText(`${SPECIAL_CSV_HEADER_LINE}\n${first}\n${second}`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.invalid[0].reason).toMatch(/export_id/i);
  });
});
