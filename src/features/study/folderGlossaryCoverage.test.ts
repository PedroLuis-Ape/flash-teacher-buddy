import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  analyzeFolderGlossaryCoverageOffThread,
  analyzeFolderGlossaryCoverageRows,
} from "./lib/folderGlossaryCoverage";
import { getFolderGlossaryCoveragePresentation } from "./lib/folderGlossaryCoveragePresentation";
import {
  getExactCoveredOccurrences,
  getExactCoveragePendingTerms,
  parseExactCoverageCompletionJson,
  serializeExactCoverageRequest,
} from "./lib/folderGlossaryExactCoverage";
import type { FolderGlossaryEntry } from "./lib/folderGlossaryTypes";

const makeEntry = (
  id: string,
  original_text: string,
  primary_translation: string,
  options: Partial<FolderGlossaryEntry> = {},
): FolderGlossaryEntry => ({
  id,
  folder_id: "folder-1",
  owner_id: "owner-1",
  original_text,
  primary_translation,
  alternative_translations: [],
  note: null,
  side: "A",
  source_language: null,
  target_language: null,
  is_active: true,
  created_at: "2026-06-24T00:00:00.000Z",
  updated_at: "2026-06-24T00:00:00.000Z",
  ...options,
});

const glossary = [
  makeEntry("that", "that", "isso"),
  makeEntry("depends", "depends", "depende"),
  makeEntry("mean-by", "mean by", "querer dizer com"),
  makeEntry("what", "what", "o que", { is_active: false }),
  makeEntry("you", "you", "você", { side: "B" }),
];

const analysisInput = {
  folderId: "folder-1",
  lists: [{ id: "list-1", title: "Filosofia" }],
  cards: [{
    id: "card-1",
    list_id: "list-1",
    term: "That depends on what you mean by freedom.",
    translation: "",
  }],
  glossary,
};

const report = analyzeFolderGlossaryCoverageRows(analysisInput);

function exactExport() {
  return JSON.parse(serializeExactCoverageRequest({
    folderTitle: "Avançado",
    labelA: "English",
    labelB: "Português",
    report,
  })) as {
    schema: string;
    audit: {
      expected_entries: number;
      exact_coverage_required: boolean;
      instructions: string[];
    };
    entries: Array<Record<string, unknown>>;
  };
}

describe("folder glossary exact coverage audit", () => {
  it("separates exact, expression, inactive, wrong-side and missing terms", () => {
    const status = new Map(report.terms.map((term) => [term.normalized, term.status]));
    expect(status.get("that")).toBe("covered");
    expect(status.get("depends")).toBe("covered");
    expect(status.get("mean")).toBe("expression");
    expect(status.get("by")).toBe("expression");
    expect(status.get("what")).toBe("inactive");
    expect(status.get("you")).toBe("wrong_side");
    expect(status.get("freedom")).toBe("missing");
    expect(report).toMatchObject({
      coveredTerms: 2,
      expressionTerms: 2,
      inactiveTerms: 1,
      wrongSideTerms: 1,
      missingTerms: 2,
      totalOccurrences: 8,
    });
  });

  it("counts only individual entries as exact coverage", () => {
    expect(report.coveredOccurrences).toBe(4);
    expect(getExactCoveredOccurrences(report)).toBe(2);
    expect(getExactCoveragePendingTerms(report).map((term) => term.normalized).sort())
      .toEqual(["by", "freedom", "mean", "on", "what", "you"]);
  });

  it("never rounds an incomplete audit up to a complete 100 percent", () => {
    const presentation = getFolderGlossaryCoveragePresentation(8_621, 8_656);
    expect(presentation).toEqual({
      percent: 99.6,
      label: "99,6",
      complete: false,
    });
  });

  it("shows complete only when every occurrence has an individual entry", () => {
    expect(getFolderGlossaryCoveragePresentation(8_656, 8_656)).toEqual({
      percent: 100,
      label: "100",
      complete: true,
    });
    expect(getFolderGlossaryCoveragePresentation(
      getExactCoveredOccurrences(report),
      report.totalOccurrences,
    )).toEqual({
      percent: 25,
      label: "25",
      complete: false,
    });
  });

  it("falls back to the same analyzer when workers are unavailable", async () => {
    const originalWorker = globalThis.Worker;
    vi.stubGlobal("Worker", undefined);

    try {
      const fallbackReport = await analyzeFolderGlossaryCoverageOffThread(analysisInput);
      expect({ ...fallbackReport, generatedAt: "dynamic" })
        .toEqual({ ...report, generatedAt: "dynamic" });
    } finally {
      if (originalWorker) vi.stubGlobal("Worker", originalWorker);
      else vi.unstubAllGlobals();
    }
  });

  it("bundles a dedicated worker for browser audits", () => {
    const coverageModule = readFileSync(
      "src/features/study/lib/folderGlossaryCoverage.ts",
      "utf8",
    );
    const workerModule = readFileSync(
      "src/features/study/lib/folderGlossaryCoverage.worker.ts",
      "utf8",
    );
    expect(coverageModule).toContain("new Worker(");
    expect(coverageModule).toContain("folder-glossary-coverage");
    expect(workerModule).toContain("analyzeFolderGlossaryCoverageRows");
  });

  it("exports every non-exact word, including words covered by expressions", () => {
    const exported = exactExport();
    const statuses = new Map(
      exported.entries.map((row) => [String(row.term).toLocaleLowerCase(), String(row.coverage_status)]),
    );

    expect(exported.schema).toBe("app-piteco-folder-glossary-exact-coverage");
    expect(exported.audit.exact_coverage_required).toBe(true);
    expect(exported.audit.expected_entries).toBe(6);
    expect(Array.from(statuses.keys()).sort()).toEqual(["by", "freedom", "mean", "on", "what", "you"]);
    expect(statuses.get("mean")).toBe("expression");
    expect(statuses.get("by")).toBe("expression");
    expect(statuses.get("what")).toBe("inactive");
    expect(statuses.get("you")).toBe("wrong_side");
    expect(exported.entries.every((row) => row.translation === "")).toBe(true);
    expect(exported.entries.every((row) => typeof row.entry_key === "string")).toBe(true);
    expect(exported.audit.instructions.join(" ")).toMatch(/palavra individual.*tradução própria/iu);
    expect(exported.audit.instructions.join(" ")).toMatch(/não remova, não combine, não duplique/iu);
  });

  it("accepts only a complete one-to-one exact glossary response", () => {
    const exported = exactExport();
    const translations: Record<string, string> = {
      on: "em",
      what: "o que",
      you: "você",
      mean: "querer dizer",
      by: "por",
      freedom: "liberdade",
    };
    exported.entries = exported.entries.map((row) => ({
      ...row,
      translation: translations[String(row.term).toLocaleLowerCase()],
    }));

    const parsed = parseExactCoverageCompletionJson(JSON.stringify(exported), report);

    expect(parsed).toHaveLength(6);
    expect(parsed.map((entry) => `${entry.side}|${entry.term.toLocaleLowerCase()}`).sort())
      .toEqual(["A|by", "A|freedom", "A|mean", "A|on", "A|what", "A|you"]);
    expect(parsed.every((entry) => entry.active === true)).toBe(true);
  });

  it("rejects omissions, blank translations, extras and changed sides", () => {
    const blank = exactExport();
    blank.entries = blank.entries.map((row, index) => ({
      ...row,
      translation: index === 0 ? "" : "preenchido",
    }));
    expect(() => parseExactCoverageCompletionJson(JSON.stringify(blank), report))
      .toThrow(/translation está vazia/iu);

    const missing = exactExport();
    missing.entries = missing.entries.slice(1).map((row) => ({ ...row, translation: "preenchido" }));
    expect(() => parseExactCoverageCompletionJson(JSON.stringify(missing), report))
      .toThrow(/quantidade incorreta.*entrada ausente/iu);

    const altered = exactExport();
    altered.entries = altered.entries.map((row) => ({ ...row, translation: "preenchido" }));
    altered.entries[0] = { ...altered.entries[0], side: "B" };
    expect(() => parseExactCoverageCompletionJson(JSON.stringify(altered), report))
      .toThrow(/termo extra ou alterado/iu);
  });

  it("exposes the strict exact export and import controls on the glossary screen", () => {
    const component = readFileSync(
      "src/features/study/components/FolderGlossaryCoverageCard.tsx",
      "utf8",
    );
    expect(component).toContain("Auditar cobertura exata do glossário");
    expect(component).toContain("Expressões não substituem palavras isoladas");
    expect(component).toContain("Exportar glossário exato JSON");
    expect(component).toContain("Importar glossário preenchido");
    expect(component).toContain("coverage.complete");
    expect(component).toContain("getExactCoveredOccurrences");
    expect(component).not.toContain("serializeMissingCoverageTerms");
  });
});
