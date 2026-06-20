import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

const flip = read("FlipStudyView.tsx");
const write = read("WriteStudyView.tsx");
const multiple = read("MultipleChoiceStudyView.tsx");
const unscramble = read("UnscrambleStudyView.tsx");
const pronunciation = read("PronunciationStudyView.tsx");
const deck = read("StudyCardDeck.tsx");
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

  it("measures the real flashcard instead of the full mode wrapper", () => {
    expect(deck).toContain("SURFACE_SELECTOR");
    expect(deck).toContain(".flip-card");
    expect(deck).toContain(".rounded-lg.border.bg-card");
    expect(deck).toContain("ResizeObserver");
    expect(deck).toContain("--deck-surface-height");
    expect(deck).toContain("deckSurfaceReady");
  });

  it("positions every deck layer from measured surface variables", () => {
    expect(css).toContain("top: var(--deck-surface-top)");
    expect(css).toContain("left: var(--deck-surface-left)");
    expect(css).toContain("width: var(--deck-surface-width)");
    expect(css).toContain("height: var(--deck-surface-height)");
    expect(css).toContain("border-radius: var(--deck-surface-radius)");
  });

  it("keeps the mobile motion restrained", () => {
    expect(css).toContain("study-deck-card-to-back-mobile");
    expect(css).toContain("study-deck-card-rise-mobile");
    expect(css).toContain("translate3d(6px, 18px, 0)");
    expect(css).toContain("translate3d(0, 7px, 0)");
    expect(css).toContain("rotate(0.65deg)");
  });

  it("keeps layout dimensions stable and supports reduced motion", () => {
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("max-width: 42rem");
  });
});
