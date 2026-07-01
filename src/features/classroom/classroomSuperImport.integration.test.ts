import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../App.tsx");
const workspace = read("../../pages/TurmaDetailWorkspace.tsx");
const actions = read("./components/ClassroomLibraryActions.tsx");
const service = read("../global-import/mappedService.ts");

describe("classroom super importer integration", () => {
  it("keeps the importer reachable from the owner workspace", () => {
    expect(app).toContain("/turmas/:turmaId/import/super");
    expect(workspace).toContain("ClassroomLibraryActions");
    expect(actions).toContain("Super Importador");
    expect(actions).toContain("/import/super");
  });

  it("uses the stable classroom gateway and undo fallback", () => {
    expect(service).toContain("CLASSROOM_IMPORT_RPC");
    expect(service).toContain("import_app_piteco_super_package_to_class_current");
    expect(service).toContain("undo_classroom_global_import_v2");
    expect(service).toContain("undo_classroom_global_import_v1");
  });
});
