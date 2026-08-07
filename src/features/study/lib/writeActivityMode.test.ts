import { beforeEach, describe, expect, it } from "vitest";
import {
  directionToRewriteSide,
  normalizeWriteActivityPreference,
  resetRewriteSideAssignmentsForTests,
  resolveRewriteSideForCard,
  rewriteSideToDirection,
} from "./writeActivityMode";

describe("writeActivityMode", () => {
  beforeEach(() => resetRewriteSideAssignmentsForTests());

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

  it("keeps fixed sides fixed", () => {
    expect(resolveRewriteSideForCard("one", "a")).toBe("a");
    expect(resolveRewriteSideForCard("two", "b")).toBe("b");
  });

  it("resolves alternating deterministically per card", () => {
    const first = resolveRewriteSideForCard("card-1", "alternating");
    expect(resolveRewriteSideForCard("card-1", "alternating")).toBe(first);
    expect(resolveRewriteSideForCard("card-1", "alternating")).toBe(first);
    // Cards diferentes podem cair em lados diferentes, mas sempre estáveis.
    const second = resolveRewriteSideForCard("card-2", "alternating");
    expect(resolveRewriteSideForCard("card-2", "alternating")).toBe(second);
    expect(["a", "b"]).toContain(second);
  });

  it("maps rewrite side and direction as a single decision", () => {
    expect(rewriteSideToDirection("a")).toBe("b-a");
    expect(rewriteSideToDirection("b")).toBe("a-b");
    expect(rewriteSideToDirection("alternating")).toBe("any");
    expect(directionToRewriteSide("b-a")).toBe("a");
    expect(directionToRewriteSide("a-b")).toBe("b");
    expect(directionToRewriteSide("any")).toBe("alternating");
  });
});
