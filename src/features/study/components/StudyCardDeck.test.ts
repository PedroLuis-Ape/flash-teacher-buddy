import { describe, expect, it } from "vitest";
import { resolveDeckSwipe } from "./StudyCardDeck";

describe("resolveDeckSwipe", () => {
  it("moves left to the next card when allowed", () => {
    expect(
      resolveDeckSwipe({
        dx: -90,
        dy: 8,
        elapsedMs: 240,
        canGoNext: true,
        canGoPrevious: true,
      }),
    ).toBe("next");
  });

  it("moves right to the previous card when allowed", () => {
    expect(
      resolveDeckSwipe({
        dx: 88,
        dy: 5,
        elapsedMs: 220,
        canGoNext: true,
        canGoPrevious: true,
      }),
    ).toBe("previous");
  });

  it("ignores vertical scrolling and short jitter", () => {
    expect(
      resolveDeckSwipe({
        dx: -30,
        dy: 110,
        elapsedMs: 180,
        canGoNext: true,
        canGoPrevious: true,
      }),
    ).toBeNull();
  });

  it("respects the first and last card boundaries", () => {
    expect(
      resolveDeckSwipe({
        dx: 100,
        dy: 0,
        elapsedMs: 180,
        canGoNext: true,
        canGoPrevious: false,
      }),
    ).toBeNull();

    expect(
      resolveDeckSwipe({
        dx: -100,
        dy: 0,
        elapsedMs: 180,
        canGoNext: false,
        canGoPrevious: true,
      }),
    ).toBeNull();
  });
});
