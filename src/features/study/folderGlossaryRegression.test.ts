import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { mergeGlossaryAndManual, type GlossaryItem } from "./lib/glossaryMerge";
import { parseFolderGlossaryJson } from "./lib/folderGlossaryTransfer";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260624120000_folder_glossary_v1.sql", import.meta.url),
  "utf8",
);
const interactiveText = readFileSync(new URL("./components/InteractiveText.tsx", import.meta.url), "utf8");
const folderGlossaryManager = readFileSync(
  new URL("./components/FolderGlossaryManagerCore.tsx", import.meta.url),
  "utf8",
);
const glossaryPage = readFileSync(new URL("../../pages/Glossary.tsx", import.meta.url), "utf8");

describe("folder-scoped glossary", () => {
  it("parses the official folder glossary JSON", () => {
    expect(parseFolderGlossaryJson(JSON.stringify({
      schema: "app-piteco-folder-glossary",
      version: "1.0",
      folder: { name: "Avançado" },
      entries: [{
        term: "could",
        translation: "poderia",
        alternatives: ["conseguia"],
        side: "A",
      }],
    }))).toEqual([
      expect.objectContaining({
        term: "could",
        translation: "poderia",
        alternatives: ["conseguia"],
        side: "A",
      }),
    ]);
  });

  it("accepts JSON files with BOM or a complete markdown code fence", () => {
    const payload = JSON.stringify({
      entries: [{ term: "however", translation: "porém", side: "A" }],
    });

    expect(parseFolderGlossaryJson(`\uFEFF${payload}`)).toHaveLength(1);
    expect(parseFolderGlossaryJson(`\`\`\`json\n${payload}\n\`\`\``)).toHaveLength(1);
  });

  it("explains when pasted JSON is incomplete", () => {
    expect(() => parseFolderGlossaryJson('{"entries":[{"term":"could"}'))
      .toThrow(/arquivo \.json original|copiado por inteiro/iu);
  });

  it("offers direct JSON file selection in the folder import dialog", () => {
    expect(folderGlossaryManager).toContain('type="file"');
    expect(folderGlossaryManager).toContain('accept=".json,application/json"');
    expect(folderGlossaryManager).toContain("Selecionar arquivo JSON");
    expect(folderGlossaryManager).toContain("entrada(s) reconhecida(s)");
  });

  it("removes list glossaries from the legacy Super Importer payload", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    const { stripGlossariesForFolderImport } = await import("../global-import/mappedService");
    const original = {
      package: {
        folders: [{
          glossary: [{ term: "folder", translation: "pasta" }],
          lists: [{ glossary: [{ term: "could", translation: "poderia" }] }],
        }],
      },
    };
    const stripped = stripGlossariesForFolderImport(original);
    expect(stripped.package.folders[0]).not.toHaveProperty("glossary");
    expect(stripped.package.folders[0].lists[0]).not.toHaveProperty("glossary");
    expect(original.package.folders[0].lists[0]).toHaveProperty("glossary");
    vi.unstubAllGlobals();
  });

  it("deduplicates equal manual and folder translations", () => {
    const glossary: GlossaryItem[] = [{
      original_text: "in",
      translated_text: "em",
      note: "preposição",
      side: "A",
      is_active: true,
    }];
    const result = mergeGlossaryAndManual("in class", "A", glossary, [{
      text: "in",
      translation: "em",
      note: "posição",
      side: "A",
    }]);
    expect(result[0].translations).toHaveLength(1);
    expect(result[0].translations[0].note).toContain("preposição");
    expect(result[0].translations[0].note).toContain("posição");
  });

  it("installs personal and classroom RLS", () => {
    expect(migration).toContain("can_read_folder_glossary_v1");
    expect(migration).toContain("is_turma_member");
    expect(migration).toContain("can_manage_folder_glossary_v1");
    expect(migration).toContain("sync_folder_glossaries_from_super_import_v1");
  });

  it("uses a bottom sheet on mobile and prioritizes the exact clicked term", () => {
    expect(interactiveText).toContain("<Sheet");
    expect(interactiveText).toContain('side="bottom"');
    expect(interactiveText).toContain("safe-area-inset-bottom");
    expect(interactiveText).toContain("exact.length > 0 ? exact : matches");
    expect(interactiveText).not.toContain("setTimeout(() => setOpen(false)");
  });

  it("retires the global account box from the main glossary route", () => {
    expect(glossaryPage).toContain("O glossário agora pertence à pasta");
    expect(glossaryPage).not.toContain("AccountGlossaryManager");
  });
});
