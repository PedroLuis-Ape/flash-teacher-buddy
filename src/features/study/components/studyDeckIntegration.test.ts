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

  it("enables swipe navigation only for Flip Fast", () => {
    expect(flip).toContain("props.fastMode");
    expect(flip).toContain("swipeNavigation");

    for (const source of [write, multiple, unscramble, pronunciation]) {
      expect(source).not.toContain("swipeNavigation");
    }
  });

  it("animates a card sinking while the next card rises", () => {
    expect(css).toContain("study-deck-card-to-back");
    expect(css).toContain("study-deck-card-rise");
    expect(css).toContain("translate3d(16px, 42px, 0)");
    expect(css).toContain("translate3d(0, 20px, 0)");
  });

  it("uses a smaller proportional transition on mobile", () => {
    expect(css).toContain("study-deck-card-to-back-mobile");
    expect(css).toContain("study-deck-card-rise-mobile");
    expect(css).toContain("translate3d(9px, 30px, 0)");
    expect(css).toContain("translate3d(0, 14px, 0)");
    expect(css).toContain("rotate(1.15deg)");
  });

  it("keeps layout dimensions stable and supports reduced motion", () => {
    expect(css).not.toContain("height: var(--deck-height)");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("max-width: 42rem");
  });
});
