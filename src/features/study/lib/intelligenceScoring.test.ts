import { describe, it, expect } from "vitest";
import {
  scoreCard,
  orderByIntelligence,
  reinjectFailedCard,
} from "./intelligenceScoring";

describe("scoreCard", () => {
  it("ranks new cards above mastered cards", () => {
    const fresh = scoreCard({ id: "a" });
    const mastered = scoreCard({
      id: "b",
      progress: { flashcard_id: "b", correct_count: 10, incorrect_count: 0 },
    });
    expect(fresh).toBeGreaterThan(mastered);
  });

  it("boosts cards with high miss rate", () => {
    const high = scoreCard({
      id: "a",
      progress: { flashcard_id: "a", correct_count: 1, incorrect_count: 9 },
    });
    const low = scoreCard({
      id: "b",
      progress: { flashcard_id: "b", correct_count: 9, incorrect_count: 1 },
    });
    expect(high).toBeGreaterThan(low);
  });

  it("applies red list boost", () => {
    const base = scoreCard({
      id: "a",
      progress: { flashcard_id: "a", correct_count: 5, incorrect_count: 5 },
    });
    const red = scoreCard({
      id: "a",
      progress: { flashcard_id: "a", correct_count: 5, incorrect_count: 5 },
      isRed: true,
    });
    expect(red).toBeGreaterThan(base);
  });
});

describe("orderByIntelligence", () => {
  it("places new cards before well-mastered ones", () => {
    const cards = [{ id: "mastered" }, { id: "new" }];
    const map = new Map([
      ["mastered", { flashcard_id: "mastered", correct_count: 8, incorrect_count: 0 }],
    ]);
    const ordered = orderByIntelligence(cards, map, new Set());
    expect(ordered[0]).toBe("new");
  });
});

describe("reinjectFailedCard", () => {
  it("inserts the failed card ~5 slots ahead", () => {
    const order = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const out = reinjectFailedCard(order, 1, "b", 5, 3);
    // current=1 ('b'), insert at 1+1+5 = 7
    expect(out).toEqual(["a", "b", "c", "d", "e", "f", "g", "b", "h"]);
  });

  it("clamps to end of deck", () => {
    const order = ["a", "b", "c"];
    const out = reinjectFailedCard(order, 1, "b", 5, 3);
    expect(out[out.length - 1]).toBe("b");
  });

  it("does not stack within lookahead window", () => {
    const order = ["a", "b", "x", "b", "y"];
    const out = reinjectFailedCard(order, 1, "b", 5, 3);
    expect(out).toBe(order); // same reference = no-op
  });
});