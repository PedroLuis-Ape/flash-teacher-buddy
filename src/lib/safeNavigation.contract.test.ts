import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getFallbackRoute } from "@/lib/safeNavigation";

const root = process.cwd();
const sourceRoot = join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry) ? [fullPath] : [];
  });
}

describe("safe back navigation contract", () => {
  it("resolves deterministic parent routes for nested screens", () => {
    expect(getFallbackRoute("/list/list-1/study")).toBe("/list/list-1");
    expect(getFallbackRoute("/list/list-1/games")).toBe("/list/list-1");
    expect(getFallbackRoute("/collection/collection-1/mixed-study")).toBe("/collection/collection-1");
    expect(getFallbackRoute("/portal/list/list-1/study")).toBe("/portal/list/list-1");
    expect(getFallbackRoute("/portal/collection/collection-1/mixed-study")).toBe("/portal/collection/collection-1");
    expect(getFallbackRoute("/folder/folder-1")).toBe("/folders");
    expect(getFallbackRoute("/turmas/class-1/import/super")).toBe("/turmas/class-1");
    expect(getFallbackRoute("/professor/alunos/student-1")).toBe("/professor/alunos");
    expect(getFallbackRoute("/notes/note-1")).toBe("/notes");
    expect(getFallbackRoute("/goals/new")).toBe("/goals");
  });

  it("does not allow page components to call raw browser back navigation", () => {
    const violations = sourceFiles(sourceRoot)
      .filter((path) => !path.endsWith("safeNavigation.ts"))
      .filter((path) => !path.endsWith("safeNavigation.contract.test.ts"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return /\bnavigate\s*\(\s*-1\s*\)/.test(source)
          || /\bwindow\.history\.back\s*\(\s*\)/.test(source);
      });

    expect(violations).toEqual([]);
  });

  it("mounts the route tracker inside BrowserRouter", () => {
    const app = readFileSync(join(sourceRoot, "App.tsx"), "utf8");
    expect(app).toContain("<NavigationHistoryTracker />");
    expect(app.indexOf("<NavigationHistoryTracker />")).toBeGreaterThan(app.indexOf("<BrowserRouter>"));
  });
});
