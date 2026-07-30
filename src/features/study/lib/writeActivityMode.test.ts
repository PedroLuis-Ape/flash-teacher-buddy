import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeWriteActivityPreference,
  resetRewriteSideAssignmentsForTests,
  resolveRewriteSideForCard,
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

  it("alternates new cards and preserves the assignment of repeated cards", () => {
    expect(resolveRewriteSideForCard("card-1", "alternating")).toBe("a");
    expect(resolveRewriteSideForCard("card-2", "alternating")).toBe("b");
    expect(resolveRewriteSideForCard("card-1", "alternating")).toBe("a");
    expect(resolveRewriteSideForCard("card-3", "alternating")).toBe("a");
  });
});
