import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const flipWrapper = read("./components/FlipStudyView.tsx");
const flipImpl = read("./components/FlipStudyView.impl.tsx");
const viewport = read("./components/FlipDoomScrollViewport.tsx");

describe("Flip doom scroll contract", () => {
  it("keeps the classic StudyCardDeck path while adding an optional mobile viewport", () => {
    expect(flipWrapper).toContain("doomScrollActive ? (");
    expect(flipWrapper).toContain("<FlipDoomScrollViewport");
    expect(flipWrapper).toContain("<StudyCardDeck");
    expect(flipWrapper).toContain("sm:hidden");
  });

  it("preserves the existing two-sided Flip implementation", () => {
    expect(flipImpl).toContain("flip-card-front");
    expect(flipImpl).toContain("flip-card-back");
    expect(flipImpl).toContain("handleFlip");
    expect(flipImpl).toContain("StudyToolsMenu");
  });

  it("uses vertical gesture physics without creating a second progress engine", () => {
    expect(viewport).toContain("translate3d(0");
    expect(viewport).toContain("onNext?.()");
    expect(viewport).toContain("onPrevious?.()");
    expect(viewport).not.toContain("supabase");
    expect(viewport).not.toContain("recordResult");
  });
});
