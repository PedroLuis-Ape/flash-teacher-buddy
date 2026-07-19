import { describe, expect, it } from "vitest";
import type { SpecialFlashcardDetail } from "@/hooks/useSpecialFlashcards";
import {
  SPECIAL_V3_INPUT_SCHEMA,
  SPECIAL_V3_RESULT_SCHEMA,
  SPECIAL_V3_VERSION,
  buildSpecialV3Batches,
  buildSpecialV3Txt,
  hashSpecialSource,
  parseSpecialV3Result,
  reconcileSpecialV3Result,
  type StoredSpecialV3Manifest,
} from "./v3Protocol";

const IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

function card(overrides: Partial<SpecialFlashcardDetail> = {}): SpecialFlashcardDetail {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    flashcard_id: "20000000-0000-4000-8000-000000000001",
    created_at: "2026-07-19T00:00:00.000Z",
    updated_at: "2026-07-19T00:00:00.000Z",
    term: "standardized",
    translation: "padronizado",
    hint: null,
    context_tag: "vocabulary",
    example_text: "The process was standardized.",
    example_translation: "O processo foi padronizado.",
    layer_index: null,
    parent_card_id: null,
    list_id: "30000000-0000-4000-8000-000000000001",
    list_title: "Avançado",
    focus_text: "standardized",
    focus_side: null,
    focus_tag: "vocabulary",
    focus_note: "Explique a diferença para standard.",
    notes: null,
    ...overrides,
  };
}

function manifestFromBatch(batch: ReturnType<typeof buildSpecialV3Batches>[number]): StoredSpecialV3Manifest {
  return {
    ...batch,
    status: "awaiting_import",
    updated_at: "2026-07-19T00:00:00.000Z",
  };
}

describe("protocolo dos Cards Especiais v3", () => {
  it("cria lotes TXT com um export_id e batch_id separado", () => {
    let index = 0;
    const batches = buildSpecialV3Batches([
      card(),
      card({
        id: "10000000-0000-4000-8000-000000000002",
        flashcard_id: "20000000-0000-4000-8000-000000000002",
        term: "machinery",
        translation: "maquinário",
      }),
    ], 1, () => IDS[index++]);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toMatchObject({
      schema: SPECIAL_V3_INPUT_SCHEMA,
      version: SPECIAL_V3_VERSION,
      export_id: IDS[0],
      batch_id: IDS[1],
      batch_index: 1,
      batch_count: 2,
      item_count: 1,
    });
    expect(batches[1].export_id).toBe(IDS[0]);
    expect(batches[1].batch_id).toBe(IDS[2]);
    expect(batches[0].items[0].source_hash).toMatch(/^sp3_[0-9a-f]{8}$/u);
  });

  it("gera um TXT autossuficiente com prompt, contrato e dados", () => {
    let index = 0;
    const batch = buildSpecialV3Batches([card()], 20, () => IDS[index++])[0];
    const text = buildSpecialV3Txt(batch);

    expect(text).toContain("APP PITECO — CARDS ESPECIAIS");
    expect(text).toContain("Responda com exatamente um objeto JSON puro e válido");
    expect(text).toContain(SPECIAL_V3_RESULT_SCHEMA);
    expect(text).toContain(batch.export_id);
    expect(text).toContain(batch.batch_id);
    expect(text).toContain('"term": "standardized"');
  });

  it("aceita somente o JSON v3 estrito", () => {
    const sourceHash = hashSpecialSource({
      term: "standardized",
      translation: "padronizado",
      hint: null,
      context_tag: "vocabulary",
      example_text: null,
      example_translation: null,
      layer_index: null,
      parent_card_id: null,
      list_id: null,
      focus_text: null,
      focus_tag: null,
      focus_note: null,
    });
    const payload = {
      schema: SPECIAL_V3_RESULT_SCHEMA,
      version: SPECIAL_V3_VERSION,
      export_id: IDS[0],
      batch_id: IDS[1],
      items: [{
        item_id: "10000000-0000-4000-8000-000000000001",
        card_id: "20000000-0000-4000-8000-000000000001",
        source_hash: sourceHash,
        detailed_explanation: "Standardized descreve algo que foi padronizado.",
        usage_notes: ["É comum em processos e normas."],
        common_mistakes: [{
          mistake: "standardize process",
          correction: "standardized process",
          explanation: "Aqui precisamos do adjetivo participial.",
        }],
      }],
    };

    expect(parseSpecialV3Result(JSON.stringify(payload))).toEqual(payload);
    expect(() => parseSpecialV3Result(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``)).toThrow(/JSON puro/iu);
    expect(() => parseSpecialV3Result(JSON.stringify({ ...payload, extra: true }))).toThrow(/JSON v3 inválido/iu);
  });

  it("reconcilia por item_id, card_id e source_hash e identifica faltantes", () => {
    let index = 0;
    const batch = buildSpecialV3Batches([
      card(),
      card({
        id: "10000000-0000-4000-8000-000000000002",
        flashcard_id: "20000000-0000-4000-8000-000000000002",
        term: "variance",
        translation: "variação",
      }),
    ], 20, () => IDS[index++])[0];
    const first = batch.items[0];
    const result = parseSpecialV3Result(JSON.stringify({
      schema: SPECIAL_V3_RESULT_SCHEMA,
      version: SPECIAL_V3_VERSION,
      export_id: batch.export_id,
      batch_id: batch.batch_id,
      items: [{
        item_id: first.item_id,
        card_id: first.card_id,
        source_hash: first.source_hash,
        detailed_explanation: "Explicação segura.",
        usage_notes: [],
        common_mistakes: [],
      }],
    }));

    const reconciled = reconcileSpecialV3Result(result, manifestFromBatch(batch));
    expect(reconciled.rows).toHaveLength(1);
    expect(reconciled.rows[0]).toMatchObject({ status: "valid", resolved_flashcard_id: first.card_id });
    expect(reconciled.missing_expected_ids).toEqual([batch.items[1].card_id]);
  });

  it("recusa source_hash alterado pela IA", () => {
    let index = 0;
    const batch = buildSpecialV3Batches([card()], 20, () => IDS[index++])[0];
    const first = batch.items[0];
    const result = parseSpecialV3Result(JSON.stringify({
      schema: SPECIAL_V3_RESULT_SCHEMA,
      version: SPECIAL_V3_VERSION,
      export_id: batch.export_id,
      batch_id: batch.batch_id,
      items: [{
        item_id: first.item_id,
        card_id: first.card_id,
        source_hash: "sp3_deadbeef",
        detailed_explanation: "Explicação.",
        usage_notes: [],
        common_mistakes: [],
      }],
    }));

    const reconciled = reconcileSpecialV3Result(result, manifestFromBatch(batch));
    expect(reconciled.rows[0]).toMatchObject({ status: "invalid" });
    expect(reconciled.rows[0].reason).toMatch(/source_hash/iu);
  });
});
