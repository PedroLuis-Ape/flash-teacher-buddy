import { describe, expect, it } from "vitest";
import {
  filterCardsForStudyScope,
  resolveStudyScope,
  shouldInjectRedPriority,
} from "./studyScopePolicy";

const layered = {
  id: "L1",
  parent_card_id: "P",
  __parentCardId: "P",
  __layers: [
    { id: "L1", parent_card_id: "P" },
    { id: "L2", parent_card_id: "P" },
  ],
};

const normal = { id: "N1", parent_card_id: null };
const other = { id: "N2", parent_card_id: null };

describe("resolveStudyScope", () => {
  it("treats redFocus as its own scope even when favorites are disabled", () => {
    expect(resolveStudyScope({ subset: "all", redFocus: true })).toBe("red");
  });

  it("uses favorites only when redFocus is disabled", () => {
    expect(resolveStudyScope({ subset: "favorites", redFocus: false })).toBe("favorites");
    expect(resolveStudyScope({ subset: "all", redFocus: false })).toBe("all");
  });
});

describe("shouldInjectRedPriority", () => {
  it("keeps red priority in favorites mode without red focus", () => {
    expect(shouldInjectRedPriority({ subset: "favorites", redFocus: false })).toBe(true);
  });

  it("never injects extra red copies during red focus", () => {
    expect(shouldInjectRedPriority({ subset: "favorites", redFocus: true })).toBe(false);
    expect(shouldInjectRedPriority({ subset: "all", redFocus: true })).toBe(false);
  });
});

describe("filterCardsForStudyScope", () => {
  it("filters favorites independently from the red list", () => {
    const result = filterCardsForStudyScope({
      cards: [layered, normal, other],
      favoriteIds: ["N1"],
      redListIds: ["P"],
      settings: { subset: "favorites", redFocus: false },
    });

    expect(result.map((card) => card.id)).toEqual(["N1"]);
  });

  it("filters red cards without requiring them to be favorites", () => {
    const result = filterCardsForStudyScope({
      cards: [layered, normal, other],
      favoriteIds: [],
      redListIds: ["P", "N2"],
      settings: { subset: "all", redFocus: true },
    });

    expect(result.map((card) => card.id)).toEqual(["L1", "N2"]);
  });

  it("matches a layered entry through parent_card_id or an inner layer", () => {
    const byParent = filterCardsForStudyScope({
      cards: [layered, normal],
      favoriteIds: [],
      redListIds: ["P"],
      settings: { subset: "all", redFocus: true },
    });
    const byLayer = filterCardsForStudyScope({
      cards: [layered, normal],
      favoriteIds: [],
      redListIds: ["L2"],
      settings: { subset: "all", redFocus: true },
    });

    expect(byParent.map((card) => card.id)).toEqual(["L1"]);
    expect(byLayer.map((card) => card.id)).toEqual(["L1"]);
  });
});
