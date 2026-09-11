import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

describe("critical overlay responsive contract", () => {
  it("keeps import and export dialogs bounded with a safe footer", () => {
    const ingest = read("src/features/smart-import/ContentIngestDialog.tsx");
    const prompt = read("src/features/smart-import/SmartPromptDialog.tsx");
    const folderExport = read("src/features/export/FolderExportDialog.tsx");

    for (const source of [ingest, prompt, folderExport]) {
      expect(source).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
      expect(source).toContain("ape-overlay-scroll");
      expect(source).toContain("safe-area-inset-bottom");
    }
  });

  it("keeps layered-card and in-game sheets usable above the gesture area", () => {
    const merge = read("src/features/cards/components/MergeIntoLayersDialog.tsx");
    const attention = read("src/features/study/components/AttentionPointSheet.tsx");
    const tools = read("src/features/study/components/StudyToolsMenu.tsx");
    const study = read("src/pages/Study.tsx");

    expect(merge).toMatch(/min-h-0[\s\S]*flex-1[\s\S]*overflow-y-auto/);
    expect(merge).toContain("safe-area-inset-bottom");
    expect(attention).toContain("safe-area-inset-bottom");
    expect(attention).toContain("touch-manipulation");
    expect(tools).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(tools).toContain("safe-area-inset-bottom");
    expect(study).toContain("safe-area-inset-bottom");
  });
});
