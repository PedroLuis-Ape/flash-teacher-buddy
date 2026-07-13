import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  analyzeFolderGlossaryCoverageOffThread,
  analyzeFolderGlossaryCoverageRows,
  serializeMissingCoverageTerms,
} from "./lib/folderGlossaryCoverage";
import { getFolderGlossaryCoveragePresentation } from "./lib/folderGlossaryCoveragePresentation";
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

describe("folder glossary coverage audit", () => {
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
    });
  });

  it("never rounds an incomplete audit up to a complete 100 percent", () => {
    const presentation = getFolderGlossaryCoveragePresentation(8_621, 8_656);
    expect(presentation).toEqual({
      percent: 99.6,
      label: "99,6",
      complete: false,
    });
  });

  it("shows complete only when every occurrence is covered", () => {
    expect(getFolderGlossaryCoveragePresentation(8_656, 8_656)).toEqual({
      percent: 100,
      label: "100",
      complete: true,
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

  it("exports only unresolved terms for AI completion", () => {
    const exported = JSON.parse(serializeMissingCoverageTerms({
      folderTitle: "Avançado",
      report,
    })) as { entries: Array<Record<string, unknown>> };
    const statuses = new Map(
      exported.entries.map((row) => [String(row.term), String(row.coverage_status)]),
    );
    expect(Array.from(statuses.keys()).sort()).toEqual(["freedom", "on", "what", "you"]);
    expect(statuses.get("what")).toBe("inactive");
    expect(statuses.get("you")).toBe("wrong_side");
    expect(exported.entries.every((row) => row.translation === "")).toBe(true);
  });

  it("exposes export and import controls on the glossary screen", () => {
    const component = readFileSync(
      "src/features/study/components/FolderGlossaryCoverageCard.tsx",
      "utf8",
    );
    expect(component).toContain("Auditar cobertura do glossário");
    expect(component).toContain("Exportar pendências JSON");
    expect(component).toContain("Exportar cobertas JSON");
    expect(component).toContain("Importar pendências preenchidas");
    expect(component).toContain("coverage.complete");
    expect(component).not.toContain("coveragePercent === 100");
  });
});
