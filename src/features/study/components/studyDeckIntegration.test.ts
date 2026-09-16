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
const flipCss = read("flipStudyMobileCompact.css");

describe("study deck integration", () => {
  it("applies the visual deck to every study mode wrapper", () => {
    for (const source of [flip, write, multiple, unscramble, pronunciation]) {
      expect(source).toContain("StudyCardDeck");
    }
  });

  it("gives Flip its own vertical feed gesture while other modes keep the shared swipe contract", () => {
    expect(flip).toContain("flip-vertical-feed-viewport");
    expect(flip).toContain("handleFeedPointerMove");
    expect(flip).toContain("handleFeedWheel");
    expect(flip).toContain('commitFeedNavigation("next")');
    expect(flip).toContain('commitFeedNavigation("previous")');
    expect(flip).not.toContain("swipeNavigation={{");

    // Do not pin this integration contract to each mode's exact callback
    // spelling. The important invariant is that every non-Flip wrapper still
    // delegates gesture handling to StudyCardDeck instead of inheriting the
    // new Flip-only vertical feed.
    for (const source of [write, multiple, unscramble, pronunciation]) {
      expect(source).toContain("swipeNavigation");
      expect(source).not.toContain("flip-vertical-feed-viewport");
    }
  });

  it("renders the next Flip surface during the drag instead of waiting for release", () => {
    expect(flip).toContain("flip-vertical-feed-preview--next");
    expect(flip).toContain("--flip-feed-offset");
    expect(flipCss).toContain("calc(100% + 12px + var(--flip-feed-offset))");
    expect(flipCss).toContain('[data-feed-dragging="true"] .flip-vertical-feed-preview');
    expect(flipCss).toContain("touch-action: none");
  });

  it("keeps Flip navigation on the existing Study callbacks so game rules still gate next/previous", () => {
    expect(flip).toContain("const canFeedNext = Boolean(props.onNext && props.canGoNext !== false)");
    expect(flip).toContain("const canFeedPrevious = Boolean(props.onPrevious && props.canGoPrevious !== false)");
    expect(flip).toContain("props.onNext?.()");
    expect(flip).toContain("props.onPrevious?.()");
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

  it("uses a stronger desktop flight and a lighter mobile flight for non-Flip deck navigation", () => {
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
    expect(flipCss).toContain("prefers-reduced-motion");
  });
});
