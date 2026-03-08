import { describe, it, expect } from "vitest";
import { parseWordHints, segmentText, hasWordHints, type WordHint } from "./wordHints";

describe("parseWordHints", () => {
  it("returns empty array for null/undefined", () => {
    expect(parseWordHints(null)).toEqual([]);
    expect(parseWordHints(undefined)).toEqual([]);
  });

  it("returns empty array for non-array", () => {
    expect(parseWordHints("string")).toEqual([]);
    expect(parseWordHints(42)).toEqual([]);
    expect(parseWordHints({})).toEqual([]);
  });

  it("filters invalid items", () => {
    const raw = [
      { text: "hello", translation: "olá" },
      { text: "", translation: "empty" },
      { text: "no-trans" },
      null,
      42,
    ];
    expect(parseWordHints(raw)).toEqual([{ text: "hello", translation: "olá" }]);
  });

  it("preserves optional note field", () => {
    const raw = [{ text: "market", translation: "mercado", note: "place to buy" }];
    expect(parseWordHints(raw)).toEqual(raw);
  });
});

describe("segmentText", () => {
  const hints: WordHint[] = [
    { text: "I", translation: "eu" },
    { text: "am going", translation: "estou indo" },
    { text: "market", translation: "mercado" },
  ];

  it("returns plain text when no hints", () => {
    expect(segmentText("Hello world", [])).toEqual([{ value: "Hello world" }]);
  });

  it("returns plain text for empty string", () => {
    expect(segmentText("", hints)).toEqual([{ value: "" }]);
  });

  it("matches single words", () => {
    const result = segmentText("I like food", [{ text: "I", translation: "eu" }]);
    expect(result.some((s) => s.hint?.translation === "eu")).toBe(true);
  });

  it("prioritizes longer expressions over shorter words", () => {
    const result = segmentText("I am going to the market", hints);
    // "am going" should be a single segment, not split into "am" and "going"
    const amGoingSegment = result.find((s) => s.value.toLowerCase() === "am going");
    expect(amGoingSegment?.hint?.translation).toBe("estou indo");
  });

  it("handles punctuation after matched word", () => {
    const result = segmentText("I went to the market, yesterday", hints);
    const marketSeg = result.find((s) => s.value.toLowerCase() === "market");
    expect(marketSeg?.hint?.translation).toBe("mercado");
  });

  it("non-matched text remains as plain segments", () => {
    const result = segmentText("I am going to the market", hints);
    const plainSegments = result.filter((s) => !s.hint);
    expect(plainSegments.length).toBeGreaterThan(0);
  });

  it("case-insensitive matching", () => {
    const result = segmentText("i AM GOING to THE MARKET", hints);
    const matched = result.filter((s) => s.hint);
    expect(matched.length).toBeGreaterThanOrEqual(2);
  });
});

describe("hasWordHints", () => {
  it("returns false for null/undefined/empty", () => {
    expect(hasWordHints(null)).toBe(false);
    expect(hasWordHints(undefined)).toBe(false);
    expect(hasWordHints([])).toBe(false);
  });

  it("returns false for invalid data", () => {
    expect(hasWordHints([{ text: "", translation: "" }])).toBe(false);
  });

  it("returns true for valid hints", () => {
    expect(hasWordHints([{ text: "hello", translation: "olá" }])).toBe(true);
  });
});

describe("backward compatibility", () => {
  it("old card without word_hints renders normally", () => {
    // Simulates a card loaded from DB with no word_hints field
    const cardData = { term: "Hello", translation: "Olá" };
    const hints = parseWordHints((cardData as any).word_hints);
    expect(hints).toEqual([]);
    const segments = segmentText(cardData.term, hints);
    expect(segments).toEqual([{ value: "Hello" }]);
  });

  it("card with null word_hints renders normally", () => {
    const hints = parseWordHints(null);
    expect(hints).toEqual([]);
    expect(segmentText("Some text", hints)).toEqual([{ value: "Some text" }]);
  });

  it("edit dialog returns original values when no hints exist", () => {
    const card = { id: "1", term: "test", translation: "teste", word_hints: null };
    const hints = parseWordHints(card.word_hints);
    expect(hints).toEqual([]);
    // Adding hints later should work
    const newHints: WordHint[] = [{ text: "test", translation: "teste" }];
    expect(parseWordHints(newHints)).toEqual(newHints);
  });

  it("persistence: empty hints array does not corrupt card", () => {
    const emptyHints = parseWordHints([]);
    expect(emptyHints).toEqual([]);
  });
});
