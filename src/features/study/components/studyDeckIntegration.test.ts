import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

const flip = read("FlipStudyView.tsx");
const write = read("WriteStudyView.tsx");
const multiple = read("MultipleChoiceStudyView.tsx");
const unscramble = read("UnscrambleStudyView.tsx");
const pronunciation = read("PronunciationStudyView.tsx");
const css = read("studyCardDeck.css");

describe("study deck integration", () => {
  it("applies the visual deck to every study mode wrapper", () => {
    for (const source of [flip, write, multiple, unscramble, pronunciation]) {
      expect(source).toContain("StudyCardDeck");
    }
  });

  it("enables the new shared swipe only for Flip Fast", () => {
    expect(flip).toContain("props.fastMode");
    expect(flip).toContain("swipeNavigation");

    for (const source of [write, multiple, unscramble, pronunciation]) {
      expect(source).not.toContain("swipeNavigation");
    }
  });

  it("keeps the stack restrained and motion accessible", () => {
    expect(css).toContain("rotate(-0.7deg)");
    expect(css).toContain("rotate(0.35deg)");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("max-width: 42rem");
  });
});
