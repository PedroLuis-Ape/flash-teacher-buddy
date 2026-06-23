import { describe, expect, it } from "vitest";
import { matchesSearchQuery, normalizeSearchText } from "./searchText";

describe("search helpers", () => {
  it("normalizes text", () => {
    expect(normalizeSearchText("  AÇÃO   Rápida ")).toBe("acao rapida");
  });

  it("matches multiple tokens", () => {
    expect(matchesSearchQuery(["Presente afirmativo", "33 cards"], "cards presente")).toBe(true);
    expect(matchesSearchQuery(["Presente afirmativo", "33 cards"], "passado presente")).toBe(false);
  });
});
