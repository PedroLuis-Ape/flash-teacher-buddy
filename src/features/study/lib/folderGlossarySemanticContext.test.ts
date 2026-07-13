import { describe, expect, it } from "vitest";
import type {
  FolderGlossaryCoverageReport,
  FolderGlossaryCoverageStatus,
} from "./folderGlossaryCoverage";
import type { FolderGlossaryEntry } from "./folderGlossaryTypes";
import { enrichSemanticCoverageReport } from "./folderGlossarySemanticContext";
import { serializeSemanticReviewRequest } from "./folderGlossarySemanticReview";

function counts(): Record<FolderGlossaryCoverageStatus, number> {
  return { covered: 1, expression: 0, inactive: 0, wrong_side: 0, missing: 0 };
}

function entry(id: string, term: string, translation: string): FolderGlossaryEntry {
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

const sentence = "Because of the rain, we stayed home.";
const glossary = [
  entry("because", "because", "porque"),
  entry("of", "of", "de"),
  entry("because-of", "because of", "por causa de"),
];

const report: FolderGlossaryCoverageReport = {
  folderId: "folder-1",
  generatedAt: "2026-07-13T12:00:00.000Z",
  listsScanned: 1,
  cardsScanned: 1,
  distinctTerms: 2,
  coveredTerms: 2,
  expressionTerms: 0,
  inactiveTerms: 0,
  wrongSideTerms: 0,
  missingTerms: 0,
  coveredOccurrences: 2,
  totalOccurrences: 2,
  usedGlossaryEntryIds: ["because", "of"],
  terms: ["Because", "of"].map((term) => ({
    term,
    normalized: term.toLocaleLowerCase(),
    side: "A" as const,
    status: "covered" as const,
    occurrenceCount: 1,
    cardCount: 1,
    listCount: 1,
    examples: [{
      cardId: "card-1",
      listId: "list-1",
      listTitle: "Weather",
      side: "A" as const,
      text: sentence,
    }],
    matchedGlossaryTerms: [term],
    statusCounts: counts(),
  })),
};

describe("semantic coverage context", () => {
  it("adds an overlapping expression without replacing individual word coverage", () => {
    const enriched = enrichSemanticCoverageReport(report, glossary);

    expect(enriched.coveredTerms).toBe(2);
    expect(enriched.usedGlossaryEntryIds).toEqual(
      expect.arrayContaining(["because", "of", "because-of"]),
    );
    expect(enriched.terms.every((term) =>
      term.matchedGlossaryTerms.includes("because of"))).toBe(true);
  });

  it("exports words and the overlapping expression as separate semantic entries", () => {
    const enriched = enrichSemanticCoverageReport(report, glossary);
    const document = JSON.parse(serializeSemanticReviewRequest({
      folderId: "folder-1",
      folderTitle: "Weather",
      labelA: "English",
      labelB: "Português",
      report: enriched,
      glossary,
    })) as {
      audit: { word_entries: number; expression_entries: number };
      entries: Array<{ term: string; entry_kind: string; examples: unknown[] }>;
    };

    expect(document.audit).toMatchObject({ word_entries: 2, expression_entries: 1 });
    expect(document.entries.map((row) => [row.term, row.entry_kind])).toEqual(
      expect.arrayContaining([
        ["because", "word"],
        ["of", "word"],
        ["because of", "expression"],
      ]),
    );
    expect(document.entries.find((row) => row.term === "because of")?.examples)
      .toHaveLength(1);
  });
});
