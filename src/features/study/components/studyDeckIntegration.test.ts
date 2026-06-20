import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

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

  it("measures the real flashcard surface with one resize observer", () => {
    expect(deck).toContain("SURFACE_SELECTOR");
    expect(deck).toContain(".flip-card");
    expect(deck).toContain(".rounded-lg.border.bg-card");
    expect(deck).toContain("ResizeObserver");
    expect(deck.match(/new ResizeObserver/g)?.length).toBe(1);
    expect(deck).not.toContain("MutationObserver");
  });

  it("uses the lightweight outgoing card path on mobile", () => {
    expect(deck).toContain("resolveFlightRenderMode");
    expect(deck).toContain("study-card-flight--${mode}");
    expect(css).toContain(".study-card-flight--lightweight");
    expect(deck).toContain("activeFlightRef.current?.remove()");
  });

  it("keeps the detailed clone restricted to full desktop rendering", () => {
    expect(deck).toContain('mode === "full"');
    expect(deck).toContain("cloneNode(true)");
    expect(deck).toContain("removeDuplicateIds");
  });

  it("positions layers from the measured flashcard surface", () => {
    expect(css).toContain("top: var(--deck-surface-top)");
    expect(css).toContain("left: var(--deck-surface-left)");
    expect(css).toContain("width: var(--deck-surface-width)");
    expect(css).toContain("height: var(--deck-surface-height)");
    expect(css).toContain("border-radius: var(--deck-surface-radius)");
  });

  it("uses a stronger desktop flight and a lighter mobile flight", () => {
    expect(css).toContain("deck-card-flight-next");
    expect(css).toContain("translate3d(-118px, -22px, 0)");
    expect(css).toContain("deck-card-flight-next-mobile");
    expect(css).toContain("translate3d(-52px, -9px, 0)");
    expect(css).toContain("deck-card-enter-previous-mobile");
  });

  it("keeps layout dimensions stable and supports reduced motion", () => {
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("max-width: 42rem");
  });
});
