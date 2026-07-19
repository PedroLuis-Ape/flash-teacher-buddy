import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  FolderGlossaryCoverageReport,
  FolderGlossaryCoverageStatus,
  FolderGlossaryCoverageTerm,
} from "./folderGlossaryCoverage";
import type { FolderGlossaryEntry } from "./folderGlossaryTypes";
import {
  getImportableSemanticEntries,
  getSemanticReviewSummary,
  parseSemanticReviewCompletionJson,
  SEMANTIC_REVIEW_SCHEMA,
  SEMANTIC_REVIEW_VERSION,
  serializeSemanticReviewRequest,
  type SemanticReviewContext,
  type SemanticReviewEntry,
} from "./folderGlossarySemanticReview";

function statusCounts(covered = 1): Record<FolderGlossaryCoverageStatus, number> {
  return { covered, expression: 0, inactive: 0, wrong_side: 0, missing: 0 };
}

function coverageTerm(value: string, text: string): FolderGlossaryCoverageTerm {
  return {
    term: value,
    normalized: value.toLocaleLowerCase(),
    side: "A",
    status: "covered",
    occurrenceCount: 1,
    cardCount: 1,
    listCount: 1,
    examples: [{
      cardId: `card-${value}`,
      listId: "list-1",
      listTitle: "History",
      side: "A",
      text,
    }],
    matchedGlossaryTerms: [value],
    statusCounts: statusCounts(),
  };
}

function glossaryEntry(id: string, term: string, translation: string): FolderGlossaryEntry {
  return {
    id,
    folder_id: "folder-1",
    owner_id: "owner-1",
    original_text: term,
    primary_translation: translation,
    alternative_translations: [],
    note: null,
    side: "A",
    source_language: "English",
    target_language: "Português",
    is_active: true,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  };
}

const canonicalWords = [
  ["millions", "Millions", "milhões"],
  ["were", "were", "foram"],
  ["enslaved", "enslaved", "escravizado"],
  ["throughout", "throughout", "ao longo de"],
  ["history", "history", "história"],
] as const;

function buildContext(size = canonicalWords.length): SemanticReviewContext {
  const source = size === canonicalWords.length
    ? canonicalWords
    : Array.from({ length: size }, (_, index) => [
      `id-${index}`,
      `term${index}`,
      `tradução ${index}`,
    ] as const);
  const sentence = "Millions were enslaved throughout history.";
  const terms = source.map(([, value]) =>
    coverageTerm(value, size === canonicalWords.length
      ? sentence
      : `${value} appears in this educational example.`));
  const glossary = source.map(([id, value, translation]) =>
    glossaryEntry(id, value, translation));
  const report: FolderGlossaryCoverageReport = {
    folderId: "folder-1",
    generatedAt: "2026-07-13T12:00:00.000Z",
    listsScanned: 1,
    cardsScanned: size,
    distinctTerms: terms.length,
    coveredTerms: terms.length,
    expressionTerms: 0,
    inactiveTerms: 0,
    wrongSideTerms: 0,
    missingTerms: 0,
    coveredOccurrences: terms.length,
    totalOccurrences: terms.length,
    usedGlossaryEntryIds: glossary.map((entry) => entry.id),
    terms,
  };
  return {
    folderId: "folder-1",
    folderTitle: "Avançado",
    labelA: "English",
    labelB: "Português",
    report,
    glossary,
  };
}

type ExportedDocument = {
  schema: string;
  version: string;
  task: string;
  folder: { name: string };
  audit: Record<string, unknown>;
  reviewer_prompt: string;
  entries: Array<Record<string, unknown>>;
};

function exportDocument(context = buildContext()): ExportedDocument {
  return JSON.parse(serializeSemanticReviewRequest(context)) as ExportedDocument;
}

function checks(overrides: Record<string, boolean> = {}) {
  return {
    context_match: true,
    part_of_speech_match: true,
    grammatical_form_match: true,
    morphology_preserved: true,
    natural_target_language: true,
    false_friend_checked: true,
    literalness_checked: true,
    all_examples_reviewed: true,
    same_language_risk: false,
    conflicting_senses: false,
    ...overrides,
  };
}

function complete(
  document: ExportedDocument,
  mutate?: (row: Record<string, unknown>, index: number) => Record<string, unknown>,
): ExportedDocument {
  document.entries = document.entries.map((row, index) => {
    const examples = row.examples as unknown[];
    const completed: Record<string, unknown> = {
      ...row,
      translation: row.current_translation,
      alternatives: row.current_alternatives,
      note: row.current_note,
      part_of_speech: "categoria gramatical identificada no contexto",
      grammatical_form: "forma flexionada identificada no contexto",
      context_summary: "O termo foi analisado em todos os exemplos fornecidos pelo aplicativo.",
      reviewed_example_indexes: examples.map((_, exampleIndex) => exampleIndex),
      evidence_examples: examples.length > 0 ? [0] : [],
      semantic_confidence: 0.96,
      ambiguity: false,
      review_status: "approved",
      review_reason: "A proposta preserva o sentido, a função gramatical e a naturalidade dos exemplos fornecidos.",
      issues: [],
      quality_checks: checks(),
    };
    return mutate ? mutate(completed, index) : completed;
  });
  return document;
}

function reviewedResult() {
  const context = buildContext();
  const document = complete(exportDocument(context), (row) =>
    String(row.term).toLocaleLowerCase() === "enslaved"
      ? {
        ...row,
        translation: "escravizados",
        part_of_speech: "verbo",
        grammatical_form: "particípio passado em voz passiva, plural",
        context_summary: "Descreve milhões de pessoas submetidas à escravidão ao longo da história.",
        review_reason: "O plural escravizados concorda com millions e preserva a construção passiva were enslaved.",
      }
      : row);
  return {
    context,
    document,
    result: parseSemanticReviewCompletionJson(JSON.stringify(document), context),
  };
}

describe("folder glossary semantic QA v1", () => {
  it("exports a comprehensive independent reviewer prompt and immutable evidence contract", () => {
    const document = exportDocument();
    const prompt = document.reviewer_prompt;

    expect(document.schema).toBe(SEMANTIC_REVIEW_SCHEMA);
    expect(document.version).toBe(SEMANTIC_REVIEW_VERSION);
    expect(document.audit).toMatchObject({
      independent_review_required: true,
      input_translation_is_untrusted: true,
      expected_entries: 5,
      word_entries: 5,
    });
    expect(prompt).toContain("REVISOR SEMÂNTICO INDEPENDENTE");
    expect(prompt).toContain("Não confirme uma tradução por deferência");
    expect(prompt).toContain("número, pessoa, tempo, aspecto, voz");
    expect(prompt).toContain("falsos cognatos");
    expect(prompt).toContain("tradução excessivamente literal");
    expect(prompt).toContain("reviewed_example_indexes deve conter TODOS os índices");
    expect(prompt).toMatch(/resposta contém somente JSON válido/iu);
    expect(document.entries.every((row) => row.semantic_confidence === null)).toBe(true);
  });

  it("accepts a complete review and returns only approved changed proposals", () => {
    const { result } = reviewedResult();
    expect(result.summary).toMatchObject({
      total: 5,
      approved: 5,
      pending: 0,
      qualityPercent: 100,
      complete: true,
      changedApproved: 1,
    });
    expect(getImportableSemanticEntries(result)).toEqual([
      expect.objectContaining({
        term: "enslaved",
        translation: "escravizados",
        side: "A",
        active: true,
      }),
    ]);
  });

  it("blocks warning proposals until each one is explicitly confirmed", () => {
    const context = buildContext();
    const document = complete(exportDocument(context), (row) =>
      String(row.term).toLocaleLowerCase() === "throughout"
        ? {
          ...row,
          translation: "por toda a extensão de",
          semantic_confidence: 0.84,
          ambiguity: true,
          review_status: "approved_with_warning",
          review_reason: "A alternativa é válida, mas o registro e a naturalidade dependem do tipo de texto usado.",
          issues: ["register_mismatch"],
        }
        : row);
    const result = parseSemanticReviewCompletionJson(JSON.stringify(document), context);
    const warning = result.entries.find((entry) => entry.review_status === "approved_with_warning");

    expect(getImportableSemanticEntries(result, { includeApproved: false })).toEqual([]);
    expect(getImportableSemanticEntries(result, {
      includeApproved: false,
      confirmedWarningKeys: [warning?.entry_key ?? ""],
    })).toEqual([
      expect.objectContaining({ term: "throughout", translation: "por toda a extensão de" }),
    ]);
  });

  it("keeps semantic quality below 100 while any reviewed entry is pending", () => {
    const { result } = reviewedResult();
    const entries = result.entries.map((entry, index): SemanticReviewEntry => index === 0
      ? {
        ...entry,
        review_status: "requires_human_review",
        semantic_confidence: 0.7,
        ambiguity: true,
        issues: ["insufficient_context"],
      }
      : entry);

    expect(getSemanticReviewSummary(entries)).toMatchObject({
      total: 5,
      approved: 4,
      pending: 1,
      qualityPercent: 80,
      complete: false,
    });
  });

  it("rejects stale evidence, modified examples, missing rows and duplicates", () => {
    const context = buildContext();

    const stale = complete(exportDocument(context));
    stale.audit.signature = "semantic-v1-stale";
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(stale), context))
      .toThrow(/versão anterior|revisão nova/iu);

    const changedExample = complete(exportDocument(context));
    changedExample.entries[0] = {
      ...changedExample.entries[0],
      examples: [{ list: "Alterada", side: "A", text: "Texto alterado." }],
    };
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(changedExample), context))
      .toThrow(/examples foi alterado/iu);

    const missing = complete(exportDocument(context));
    missing.entries = missing.entries.slice(1);
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(missing), context))
      .toThrow(/quantidade incorreta.*entrada ausente/iu);

    const duplicate = complete(exportDocument(context));
    duplicate.entries[1] = { ...duplicate.entries[0] };
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(duplicate), context))
      .toThrow(/entrada duplicada|entrada ausente/iu);
  });

  it("rejects invalid confidence, incomplete evidence and inconsistent approval", () => {
    const context = buildContext();

    const confidence = complete(exportDocument(context));
    confidence.entries[0] = { ...confidence.entries[0], semantic_confidence: 1.4 };
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(confidence), context))
      .toThrow(/entre 0 e 1/iu);

    const evidence = complete(exportDocument(context));
    evidence.entries[0] = { ...evidence.entries[0], reviewed_example_indexes: [] };
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(evidence), context))
      .toThrow(/todos os exemplos/iu);

    const approval = complete(exportDocument(context));
    approval.entries[0] = { ...approval.entries[0], semantic_confidence: 0.7 };
    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(approval), context))
      .toThrow(/approved exige confiança mínima/iu);
  });

  it("blocks same-language proposals from automatic approval", () => {
    const context = buildContext();
    const document = complete(exportDocument(context), (row, index) => index === 0
      ? {
        ...row,
        translation: row.term,
        quality_checks: checks({ same_language_risk: false }),
      }
      : row);

    expect(() => parseSemanticReviewCompletionJson(JSON.stringify(document), context))
      .toThrow(/tradução idêntica ao termo|mesmo idioma/iu);
  });

  it("requires exact structural coverage and scales to thousands of rows", { timeout: 20_000 }, () => {
    const incomplete = buildContext();
    incomplete.report.coveredTerms -= 1;
    incomplete.report.missingTerms = 1;
    incomplete.report.terms[0] = {
      ...incomplete.report.terms[0],
      status: "missing",
      statusCounts: { ...statusCounts(0), missing: 1 },
    };
    expect(() => serializeSemanticReviewRequest(incomplete))
      .toThrow(/complete primeiro a cobertura exata/iu);

    const context = buildContext(2_000);
    const document = complete(exportDocument(context));
    const result = parseSemanticReviewCompletionJson(JSON.stringify(document), context);
    expect(result.summary).toMatchObject({
      total: 2_000,
      approved: 2_000,
      qualityPercent: 100,
      complete: true,
    });
  });

  it("exposes export, import, pending review and explicit write controls", () => {
    const ui = readFileSync(
      "src/features/study/components/FolderGlossarySemanticReview.tsx",
      "utf8",
    );
    const card = readFileSync(
      "src/features/study/components/FolderGlossarySemanticReviewCard.tsx",
      "utf8",
    );
    const manager = readFileSync(
      "src/features/study/components/FolderGlossaryManager.tsx",
      "utf8",
    );

    expect(ui).toContain("Exportar para revisão semântica");
    expect(ui).toContain("Importar revisão semântica");
    expect(ui).toContain("Ver pendências semânticas");
    expect(ui).toContain("Aplicar correções aprovadas");
    expect(ui).toContain("Aplicar ressalvas confirmadas");
    expect(ui).toContain("Nenhuma alteração foi gravada ainda");
    expect(card).toContain("Auditar qualidade semântica");
    expect(manager).toContain("FolderGlossarySemanticReviewCard");
  });
});
