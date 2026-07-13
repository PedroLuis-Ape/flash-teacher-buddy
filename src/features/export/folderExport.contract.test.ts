import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("folder export contract", () => {
  it("keeps personal folder export prominent and explicit", () => {
    const workspace = read("src/pages/FolderWorkspace.tsx");
    expect(workspace).toContain("FolderExportDialog");
    expect(workspace).toContain("user && id");
    expect(workspace).toContain("Exportar todos os flashcards");
    expect(workspace).toContain("folder-export-primary-action");
    expect(workspace).toContain("fixed bottom-20 right-3");
  });

  it("keeps classroom folder export available", () => {
    const actions = read("src/features/classroom/components/ClassroomLibraryActions.tsx");
    expect(actions).toContain("FolderExportDialog");
    expect(actions).toContain("Exportar pastas");
  });

  it("keeps the import-compatible exporter complete and paginated", () => {
    const exporter = read("src/features/export/folderExport.ts");
    const dialog = read("src/features/export/FolderExportDialog.tsx");
    expect(exporter).toContain("app-piteco-super-import");
    expect(exporter).toContain("word_hints");
    expect(exporter).toContain("parent_card_id");
    expect(exporter).toContain("layered");
    expect(exporter).toContain("PAGE_SIZE");
    expect(dialog).toContain("Todas as listas e todos os cards acessíveis");
    expect(dialog).toContain("Baixar TXT");
    expect(dialog).toContain("Baixar JSON");
  });
});
