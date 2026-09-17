import { describe, expect, it } from "vitest";
import { resolveFlipDoomGesture } from "./FlipDoomScrollViewport";

describe("resolveFlipDoomGesture", () => {
  it("moves to the next card after a committed upward drag", () => {
    expect(resolveFlipDoomGesture({
      dy: -90,
      elapsedMs: 300,
      viewportHeight: 320,
      canGoNext: true,
      canGoPrevious: true,
    })).toBe("next");
  });

  it("moves to the previous card after a committed downward drag", () => {
    expect(resolveFlipDoomGesture({
      dy: 90,
      elapsedMs: 300,
      viewportHeight: 320,
      canGoNext: true,
      canGoPrevious: true,
    })).toBe("previous");
  });

  it("accepts a short fast flick", () => {
    expect(resolveFlipDoomGesture({
      dy: -34,
      elapsedMs: 50,
      viewportHeight: 320,
      canGoNext: true,
      canGoPrevious: true,
    })).toBe("next");
  });

  it("snaps back for a short slow drag", () => {
    expect(resolveFlipDoomGesture({
      dy: -25,
      elapsedMs: 400,
      viewportHeight: 320,
      canGoNext: true,
      canGoPrevious: true,
    })).toBeNull();
  });

  it("does not bypass a blocked next card", () => {
    expect(resolveFlipDoomGesture({
      dy: -140,
      elapsedMs: 200,
      viewportHeight: 320,
      canGoNext: false,
      canGoPrevious: true,
    })).toBeNull();
  });
});
