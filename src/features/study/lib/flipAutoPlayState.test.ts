import { describe, expect, it } from "vitest";
import { getNextFlipAutoPlayStep } from "./flipAutoPlayState";

describe("getNextFlipAutoPlayStep", () => {
  it("advances after one side in single-side mode", () => {
    expect(getNextFlipAutoPlayStep({
      mode: "single",
      configuredSide: "b",
      currentSide: "b",
    })).toEqual({ action: "next" });
  });

  it("switches to the opposite side first in both-side mode", () => {
    expect(getNextFlipAutoPlayStep({
      mode: "both",
      configuredSide: "a",
      currentSide: "a",
    })).toEqual({ action: "switch", side: "b" });
  });

  it("advances after the second side in both-side mode", () => {
    expect(getNextFlipAutoPlayStep({
      mode: "both",
      configuredSide: "a",
      currentSide: "b",
    })).toEqual({ action: "next" });
  });
});