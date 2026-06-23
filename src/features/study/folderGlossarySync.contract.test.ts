import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("folder glossary synchronization", () => {
  it("keeps the account glossary as the single destination", () => {
    const api = read("src/features/study/lib/folderGlossaryApi.ts");
    expect(api).toContain("importAccountGlossary");
    expect(api).toContain("includeNormalCards = false");
    expect(api).toContain("glossaryEntryIdentity");
  });

  it("offers individual and classroom-wide manual synchronization", () => {
    const dialog = read("src/features/study/components/FolderGlossarySyncDialog.tsx");
    const classroom = read("src/features/classroom/components/ClassroomLibraryActions.tsx");
    expect(dialog).toContain("Também usar cards normais");
    expect(classroom).toContain("Sincronizar todas as pastas");
    expect(classroom).toContain("FolderGlossarySyncDialog");
  });

  it("exposes a folder-filtered glossary view", () => {
    const page = read("src/pages/Glossary.tsx");
    expect(page).toContain('params.get("folder")');
    expect(page).toContain("Glossário desta pasta");
  });

  it("marks search inputs as instant search fields", () => {
    const input = read("src/components/ui/input.tsx");
    expect(input).toContain('type === "search"');
    expect(input).toContain("filtra enquanto digita");
  });
});
