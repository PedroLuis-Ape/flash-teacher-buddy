import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("teacher classes", () => {
  it("keeps creation links", () => {
    expect(read("src/components/TurmaShortcut.tsx")).toContain("/turmas/professor?create=1");
    expect(read("src/pages/TurmasProfessor.tsx")).toContain("create");
  });

  it("keeps owner navigation", () => {
    const workspace = read("src/pages/TurmaDetailWorkspace.tsx");
    expect(workspace).toContain("TeacherClassNavigation");
    expect(workspace).toContain("ClassroomLibraryActions");
  });

  it("loads owned classes", () => {
    expect(read("supabase/functions/turmas-mine/index.ts")).toContain("owner_teacher_id");
    expect(read("src/features/classroom/hooks/useTurmas.ts")).toContain("readTurmaCreateFunctionError");
  });
});
