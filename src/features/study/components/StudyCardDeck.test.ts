import { describe, expect, it } from "vitest";
import { resolveDeckSwipe, resolveFlightRenderMode } from "./StudyCardDeck";

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

describe("resolveFlightRenderMode", () => {
  it("uses a lightweight outgoing card on mobile and coarse pointers", () => {
    expect(
      resolveFlightRenderMode({
        viewportWidth: 390,
        coarsePointer: false,
        reducedMotion: false,
        animationsDisabled: false,
      }),
    ).toBe("lightweight");

    expect(
      resolveFlightRenderMode({
        viewportWidth: 1200,
        coarsePointer: true,
        reducedMotion: false,
        animationsDisabled: false,
      }),
    ).toBe("lightweight");
  });

  it("keeps the full visual clone only on larger fine-pointer screens", () => {
    expect(
      resolveFlightRenderMode({
        viewportWidth: 1280,
        coarsePointer: false,
        reducedMotion: false,
        animationsDisabled: false,
      }),
    ).toBe("full");
  });

  it("disables flight animation for reduced motion and performance mode", () => {
    expect(
      resolveFlightRenderMode({
        viewportWidth: 390,
        coarsePointer: true,
        reducedMotion: true,
        animationsDisabled: false,
      }),
    ).toBe("disabled");

    expect(
      resolveFlightRenderMode({
        viewportWidth: 1280,
        coarsePointer: false,
        reducedMotion: false,
        animationsDisabled: true,
      }),
    ).toBe("disabled");
  });
});
