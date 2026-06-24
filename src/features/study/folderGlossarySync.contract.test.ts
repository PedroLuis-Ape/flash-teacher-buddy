import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("folder glossary synchronization", () => {
  it("uses the folder glossary as the canonical destination", () => {
    const api = read("src/features/study/lib/folderGlossaryApi.ts");
    const importer = read("src/features/global-import/mappedService.ts");
    expect(api).toContain("get_folder_glossary_v1");
    expect(api).toContain("import_folder_glossary_v1");
    expect(api).not.toContain("importAccountGlossary");
    expect(importer).toContain("stripGlossariesForFolderImport");
    expect(importer).toContain("sync_folder_glossaries_from_super_import_v1");
  });

  it("offers a special folder entry and read-only classroom mode", () => {
    const card = read("src/features/study/components/FolderGlossaryCard.tsx");
    const manager = read("src/features/study/components/FolderGlossaryManager.tsx");
    const classroom = read("src/features/classroom/components/ClassroomLibraryActions.tsx");
    expect(card).toContain("Glossário da pasta");
    expect(card).toContain("Somente leitura");
    expect(manager).toContain("canEdit");
    expect(manager).toContain("Mesclar com o glossário atual");
    expect(manager).toContain("Substituir o glossário atual");
    expect(classroom).toContain("FolderGlossarySyncDialog");
  });

  it("exposes the folder glossary view", () => {
    const page = read("src/pages/Glossary.tsx");
    expect(page).toContain('params.get("folder")');
    expect(page).toContain("Glossário da pasta");
    expect(page).toContain("O glossário agora pertence à pasta");
  });

  it("marks search inputs as instant search fields", () => {
    const input = read("src/components/ui/input.tsx");
    expect(input).toContain('type === "search"');
    expect(input).toContain("filtra enquanto digita");
  });
});
