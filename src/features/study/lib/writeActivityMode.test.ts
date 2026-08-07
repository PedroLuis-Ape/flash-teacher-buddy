import { describe, expect, it } from "vitest";
import { hashToBool } from "./gameCore";
import {
  directionToRewriteSide,
  normalizeWriteActivityPreference,
  resetRewriteSideAssignmentsForTests,
  resolveRewriteSideForCard,
  rewriteSideToDirection,
} from "./writeActivityMode";

describe("writeActivityMode", () => {
  it("normalizes invalid values to translation with alternating sides", () => {
    expect(normalizeWriteActivityPreference({ mode: "invalid", rewriteSide: "x" })).toEqual({
      mode: "translate",
      rewriteSide: "alternating",
    });
  });

  it("keeps valid rewrite preferences", () => {
    expect(normalizeWriteActivityPreference({ mode: "rewrite", rewriteSide: "b" })).toEqual({
      mode: "rewrite",
      rewriteSide: "b",
    });
  });

  it("maps rewrite target and practice direction bidirectionally", () => {
    expect(rewriteSideToDirection("a")).toBe("b-a");
    expect(rewriteSideToDirection("b")).toBe("a-b");
    expect(rewriteSideToDirection("alternating")).toBe("any");
    expect(directionToRewriteSide("b-a")).toBe("a");
    expect(directionToRewriteSide("a-b")).toBe("b");
    expect(directionToRewriteSide("any")).toBe("alternating");
  });

  it("keeps fixed sides fixed across every card", () => {
    expect(resolveRewriteSideForCard("one", "a")).toBe("a");
    expect(resolveRewriteSideForCard("two", "a")).toBe("a");
    expect(resolveRewriteSideForCard("one", "b")).toBe("b");
    expect(resolveRewriteSideForCard("two", "b")).toBe("b");
  });

  it("uses the same deterministic answer side implied by direction any", () => {
    for (const cardKey of ["card-1", "card-2", "card-3", "layer-1"]) {
      const expected = hashToBool(cardKey) ? "b" : "a";
      expect(resolveRewriteSideForCard(cardKey, "alternating")).toBe(expected);
      expect(resolveRewriteSideForCard(cardKey, "alternating")).toBe(expected);
    }
  });

  it("keeps the legacy reset helper harmless because resolution is stateless", () => {
    const before = resolveRewriteSideForCard("card-1", "alternating");
    resetRewriteSideAssignmentsForTests();
    expect(resolveRewriteSideForCard("card-1", "alternating")).toBe(before);
  });
});
