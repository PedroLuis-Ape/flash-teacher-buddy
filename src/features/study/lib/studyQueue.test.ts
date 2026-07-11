import { describe, expect, it } from "vitest";
import { buildStudyQueue } from "./studyQueue";

const cards = [
  { id: "A", parent_card_id: null },
  { id: "B", parent_card_id: null },
  { id: "C", parent_card_id: null },
];

describe("buildStudyQueue", () => {
  it("preserves sequential order and removes duplicate playable entries", () => {
    const result = buildStudyQueue({
      cards: [cards[0], cards[1], cards[0], cards[2]],
      favoriteIds: [],
      redListIds: [],
      settings: { mode: "sequential", subset: "all", redFocus: false },
    });

    expect(result.scope).toBe("all");
    expect(result.queue).toEqual(["A", "B", "C"]);
  });

  it("runs red focus as a unique linear queue even when random mode was requested", () => {
    const result = buildStudyQueue({
      cards,
      favoriteIds: [],
      redListIds: ["C", "A", "C"],
      settings: { mode: "random", subset: "all", redFocus: true },
      random: () => 0,
    });

    expect(result.scope).toBe("red");
    expect(result.queue).toEqual(["A", "C"]);
  });

  it("filters favorites without automatically mixing red cards", () => {
    const result = buildStudyQueue({
      cards,
      favoriteIds: ["B"],
      redListIds: ["A"],
      settings: { mode: "sequential", subset: "favorites", redFocus: false },
    });

    expect(result.scope).toBe("favorites");
    expect(result.queue).toEqual(["B"]);
  });

  it("uses deterministic Fisher-Yates when a random generator is supplied", () => {
    const values = [0, 0];
    const result = buildStudyQueue({
      cards,
      favoriteIds: [],
      redListIds: [],
      settings: { mode: "random", subset: "all", redFocus: false },
      random: () => values.shift() ?? 0,
    });

    expect(result.queue).toEqual(["B", "C", "A"]);
    expect(new Set(result.queue)).toEqual(new Set(["A", "B", "C"]));
  });

  it("resolves layered canonical ids to the playable entry", () => {
    const layeredCards = [
      { id: "L1", parent_card_id: "P" },
      { id: "N1", parent_card_id: null },
    ];
    const result = buildStudyQueue({
      cards: layeredCards,
      favoriteIds: [],
      redListIds: ["P"],
      settings: { mode: "sequential", subset: "all", redFocus: true },
    });

    expect(result.queue).toEqual(["L1"]);
  });
});
