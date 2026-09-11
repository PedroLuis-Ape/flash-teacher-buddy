import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

describe("folder and card overlay responsive contract", () => {
  it("keeps folder create/edit/settings dialogs within the visual viewport", () => {
    const folder = read("src/pages/Folder.tsx");

    expect(folder).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(folder).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(folder).toContain("safe-area-inset-bottom");
    expect(folder).toContain("touch-manipulation");
  });

  it("keeps editing a card scrollable with an action above the gesture area", () => {
    const card = read("src/components/EditFlashcardDialog.tsx");

    expect(card).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(card).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(card).toContain("safe-area-inset-bottom");
    expect(card).toContain("min-h-11");
  });
});
