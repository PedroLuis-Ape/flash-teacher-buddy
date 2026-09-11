import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("universal previous-card navigation", () => {
  it.each([
    "./WriteStudyView.tsx",
    "./MultipleChoiceStudyView.tsx",
    "./UnscrambleStudyView.tsx",
    "./PronunciationStudyView.tsx",
  ])("wires deck swipe navigation in %s", (file) => {
    const source = read(file);
    expect(source).toContain("swipeNavigation");
    expect(source).toContain("onPrevious: props.onPrevious");
    expect(source).toContain("canGoPrevious: props.canGoPrevious");
  });

  it("keeps mixed slots on the same previous-card contract", () => {
    const source = read("./MixedSlotActivity.tsx");
    expect(source).toContain("onPrevious?: () => void");
    expect(source.match(/onPrevious=\{props\.onPrevious\}/g)).toHaveLength(2);
  });
});