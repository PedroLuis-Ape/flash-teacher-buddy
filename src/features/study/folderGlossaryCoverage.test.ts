import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeFolderGlossaryCoverageRows,
  serializeMissingCoverageTerms,
  serializeUsedCoverageEntries,
} from "./lib/folderGlossaryCoverage";
import type { FolderGlossaryEntry } from "./lib/folderGlossaryTypes";

function entry(input: Partial<FolderGlossaryEntry> & Pick<FolderGlossaryEntry, "id" | "original_text" | "primary_translation">): FolderGlossaryEntry {
  return {
    id: input.id,
    folder_id: "folder-1",
    owner_id: "owner-1",
    original_text: input.original_text,
    primary_translation: input.primary_translation,
    alternative_translations: input.alternative_translations ?? [],
    note: input.note ?? null,
    side: input.side ?? "A",
    source_language: input.source_language ?? null,
    target_language: input.target_language ?? null,
    is_active: input.is_active ?? true,
    created_at: input.created_at ?? "2026-06-24T00:00:00.000Z",
    updated_at: input.updated_at ?? "2026-06-24T00:00:00.000Z",
  };
}

describe("folder glossary coverage audit", () => {
  const glossary = [
    entry({ id: "that", original_text: "that", primary_translation: "isso" }),
    entry({ id: "depends", original_text: "depends", primary_translation: "depende" }),
    entry({ id: "mean-by", original_text: "mean by", primary_translation: "querer dizer com" }),
    entry({ id: "what", original_text: "what", primary_translation: "o que", is_active: false }),
    entry({ id: "you", original_text: "you", primary_translation: "você", side: "B" }),
  ];

  const report = analyzeFolderGlossaryCoverageRows({
    folderId: "folder-1",
    lists: [{ id: "list-1", title: "Filosofia" }],
    cards: [{
      id: "card-1",
      list_id: "list-1",
      term: "That depends on what you mean by freedom.",
      translation: "",
    }],
    glossary,
  });

  it("separates exact, expression, inactive, wrong-side and missing terms", () => {
    const byTerm = new Map(report.terms.map((term) => [term.normalized, term]));

    expect(byTerm.get("that")?.status).toBe("covered");
    expect(byTerm.get("depends")?.status).toBe("covered");
    expect(byTerm.get("mean")?.status).toBe("expression");
    expect(byTerm.get("by")?.status).toBe("expression");
    expect(byTerm.get("what")?.status).toBe("inactive");
    expect(byTerm.get("you")?.status).toBe("wrong_side");
    expect(byTerm.get("freedom")?.status).toBe("missing");
    expect(report).toMatchObject({
      listsScanned: 1,
      cardsScanned: 1,
      coveredTerms: 2,
      expressionTerms: 2,
      inactiveTerms: 1,
      wrongSideTerms: 1,
      missingTerms: 2,
    });
  });

  it("exports only unresolved terms with empty translations for AI completion", () => {
    const exported = JSON.parse(serializeMissingCoverageTerms({
      folderTitle: "Avançado",
      report,
    })) as { entries: Array<Record<string, unknown>> };

    expect(exported.entries.map((row) => row.term)).toEqual([
      "on",
      "what",
      "you",
      "freedom",
    ]);
    expect(exported.entries.every((row) => row.translation === "")).toBe(true);
    expect(exported.entries.map((row) => row.coverage_status)).toEqual([
      "missing",
      "inactive",
      "wrong_side",
      "missing",
    ]);
  });

  it("exports glossary entries that are actually used by cards", () => {
    const exported = JSON.parse(serializeUsedCoverageEntries({
      folderTitle: "Avançado",
      report,
      glossary,
    })) as { entries: Array<{ term: string }> };

    expect(exported.entries.map((row) => row.term).sort()).toEqual([
      "depends",
      "mean by",
      "that",
      "what",
      "you",
    ].sort());
  });

  it("exposes the focused audit controls on the glossary page", () => {
    const component = readFileSync(
      "src/features/study/components/FolderGlossaryCoverageCard.tsx",
      "utf8",
    );
    const manager = readFileSync(
      "src/features/study/components/FolderGlossaryManager.tsx",
      "utf8",
    );

    expect(component).toContain("Auditar cobertura do glossário");
    expect(component).toContain("Exportar pendências JSON");
    expect(component).toContain("Exportar cobertas JSON");
    expect(component).toContain("Importar pendências preenchidas");
    expect(manager).toContain("FolderGlossaryCoverageCard");
  });
});
