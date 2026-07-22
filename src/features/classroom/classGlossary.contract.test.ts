import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("class glossary contract", () => {
  it("reuses the consolidated folder glossary engine without a parallel table", () => {
    const storage = read("src/features/classroom/lib/classGlossary.ts");
    const manager = read("src/features/classroom/components/ClassGlossaryManager.tsx");

    expect(storage).toContain('CLASS_GLOSSARY_FOLDER_MARKER = "ape-system:class-glossary:v1"');
    expect(storage).toContain('.from("folders")');
    expect(storage).toContain("loadFolderGlossary(storage.id)");
    expect(storage).not.toContain('.from("class_glossary")');
    expect(manager).toContain("FolderGlossaryManagerCore");
    expect(manager).toContain("FolderGlossaryBulkDeleteCard");
  });

  it("isolates one storage container per class and scans only assigned materials", () => {
    const storage = read("src/features/classroom/lib/classGlossary.ts");

    expect(storage).toContain('.eq("class_id", turmaId)');
    expect(storage).toContain('.eq("description", CLASS_GLOSSARY_FOLDER_MARKER)');
    expect(storage).toContain('.from("atribuicoes")');
    expect(storage).toContain('item.fonte_tipo === "lista"');
    expect(storage).toContain('item.fonte_tipo === "pasta"');
    expect(storage).toContain("analyzeFolderGlossaryCoverageOffThread");
  });

  it("exposes the class glossary from the teacher class navigation", () => {
    const navigation = read("src/features/classroom/components/TeacherClassNavigation.tsx");
    const workspace = read("src/pages/TurmaDetailWorkspace.tsx");

    expect(navigation).toContain("?tab=glossario");
    expect(navigation).toContain("Glossário");
    expect(workspace).toContain("<ClassGlossaryManager");
    expect(workspace).toContain('selectedTab === "glossario"');
  });

  it("uses the class glossary during study entered from a classroom", () => {
    const hook = read("src/hooks/useListGlossary.ts");
    const workspace = read("src/pages/TurmaDetailWorkspace.tsx");
    const hub = read("src/pages/GamesHub.tsx");

    expect(workspace).toContain("markPendingClassGlossaryContext(turmaId)");
    expect(hub).toContain("isListAssignedToClass");
    expect(hub).toContain('params.set("turma", activeTurmaId)');
    expect(hook).toContain("readPendingClassGlossaryContext");
    expect(hook).toContain("loadClassGlossaryForList");
    expect(hook).toContain('source: "class-glossary"');
    expect(hook).toContain("turmaIsExplicit");
  });

  it("keeps folder and class glossaries independent", () => {
    const storage = read("src/features/classroom/lib/classGlossary.ts");
    const manager = read("src/features/classroom/components/ClassGlossaryManager.tsx");
    const sync = read("src/features/classroom/components/ClassGlossarySyncCard.tsx");

    expect(storage).toContain('visibility: "class"');
    expect(manager).toContain("não altera os glossários das pastas pessoais");
    expect(sync).toContain("Nenhuma entrada é copiada para pastas pessoais");
  });
});
