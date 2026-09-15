import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const librarySource = readFileSync(new URL("../../features/library/FoldersOptimized.tsx", import.meta.url), "utf8");
const folderSource = readFileSync(new URL("../Folder.tsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../FolderWorkspace.tsx", import.meta.url), "utf8");
const toolsSource = readFileSync(new URL("../../features/study/components/StudyToolsMenu.tsx", import.meta.url), "utf8");
const toolsCss = readFileSync(new URL("../../features/study/components/study-tools-menu.css", import.meta.url), "utf8");
const writeSource = readFileSync(new URL("../../features/study/components/WriteStudyView.impl.tsx", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

describe("mobile responsive layout hotfix", () => {
  it("keeps library actions inside the narrow viewport", () => {
    expect(librarySource).toContain("!grid w-full grid-cols-2");
    expect(librarySource).toContain('label="Exportar"');
    expect(librarySource).toContain("sm:flex-row sm:items-center sm:justify-between");
  });

  it("uses a compact folder action grid and mobile list menu", () => {
    expect(folderSource).toContain("!grid w-full grid-cols-2");
    expect(folderSource).toContain('className="shrink-0 sm:hidden"');
    expect(folderSource).toContain('className="hidden shrink-0 gap-1 sm:flex"');
    expect(folderSource).toContain("setListToDelete(list)");
  });

  it("keeps folder export static on mobile and floating only on desktop", () => {
    expect(workspaceSource).toContain("hidden md:block");
    expect(workspaceSource).toContain('label="Exportar flashcards"');
    expect(workspaceSource).toContain('className="md:hidden"');
  });

  it("pins the study tools to compact mobile widths", () => {
    expect(toolsSource).toContain("study-tools-rate-button");
    expect(toolsSource).toContain("!w-[4.25rem]");
    expect(toolsSource).toContain("!w-11 !min-w-11");
    expect(toolsCss).toContain("@media (max-width: 359px)");
    expect(toolsCss).toContain("flex: 0 0 4.25rem !important");
  });

  it("keeps write input shrink-safe with the virtual keyboard", () => {
    expect(writeSource).toContain("w-full min-w-0 min-h-[80px]");
    expect(writeSource).toContain('className="min-w-0 space-y-4"');
  });

  it("does not globally force action clusters to shrink-0", () => {
    expect(indexCss).toContain("@apply flex min-w-0 max-w-full items-center gap-1 sm:gap-2;");
  });
});
