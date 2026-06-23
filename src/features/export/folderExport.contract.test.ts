import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("folder export contract", () => {
  it("keeps personal folder export available", () => {
    const workspace = read("src/pages/FolderWorkspace.tsx");
    expect(workspace).toContain("FolderExportDialog");
    expect(workspace).toContain("user && id");
  });

  it("keeps classroom folder export available", () => {
    const actions = read("src/features/classroom/components/ClassroomLibraryActions.tsx");
    expect(actions).toContain("FolderExportDialog");
    expect(actions).toContain("Exportar pastas");
  });

  it("keeps the import-compatible exporter", () => {
    const exporter = read("src/features/export/folderExport.ts");
    expect(exporter).toContain("app-piteco-super-import");
    expect(exporter).toContain("word_hints");
    expect(exporter).toContain("PAGE_SIZE");
  });
});
