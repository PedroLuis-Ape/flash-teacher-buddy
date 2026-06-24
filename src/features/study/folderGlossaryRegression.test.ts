import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeGlossaryAndManual, type GlossaryItem } from "./lib/glossaryMerge";
import { parseFolderGlossaryJson } from "./lib/folderGlossaryTransfer";
import { stripGlossariesForFolderImport } from "../global-import/mappedService";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260624120000_folder_glossary_v1.sql", import.meta.url),
  "utf8",
);
const interactiveText = readFileSync(new URL("./components/InteractiveText.tsx", import.meta.url), "utf8");
const glossaryPage = readFileSync(new URL("../../pages/Glossary.tsx", import.meta.url), "utf8");

describe("folder-scoped glossary", () => {
  it("parses the official folder glossary JSON", () => {
    expect(parseFolderGlossaryJson(JSON.stringify({
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

  it("removes list glossaries from the legacy Super Importer payload", () => {
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

  it("uses a bottom sheet on mobile and removes automatic closing", () => {
    expect(interactiveText).toContain("<Sheet");
    expect(interactiveText).toContain('side="bottom"');
    expect(interactiveText).toContain("safe-area-inset-bottom");
    expect(interactiveText).not.toContain("setTimeout(() => setOpen(false)");
  });

  it("retires the global account box from the main glossary route", () => {
    expect(glossaryPage).toContain("O glossário agora pertence à pasta");
    expect(glossaryPage).not.toContain("AccountGlossaryManager");
  });
});
