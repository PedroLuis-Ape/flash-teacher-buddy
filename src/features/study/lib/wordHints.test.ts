import { describe, it, expect } from "vitest";
import {
  parseWordHints,
  segmentText,
  segmentTextByIndex,
  hasWordHints,
  validateHintIndices,
  revalidateHints,
  type WordHint,
} from "./wordHints";

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

  it("preserves startIndex and endIndex", () => {
    const raw = [{ text: "hello", translation: "olá", startIndex: 0, endIndex: 5 }];
    const result = parseWordHints(raw);
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(5);
  });
});

// ─── INDEX-BASED SEGMENTATION ───

describe("segmentTextByIndex", () => {
  it("segments text using exact indices", () => {
    const text = "I am going to the market";
    const hints: WordHint[] = [
      { text: "I", translation: "eu", startIndex: 0, endIndex: 1 },
      { text: "am going", translation: "estou indo", startIndex: 2, endIndex: 10 },
      { text: "market", translation: "mercado", startIndex: 18, endIndex: 24 },
    ];
    const result = segmentTextByIndex(text, hints);

    expect(result[0]).toEqual({ value: "I", hint: hints[0] });
    expect(result[1]).toEqual({ value: " " });
    expect(result[2]).toEqual({ value: "am going", hint: hints[1] });
    expect(result[3]).toEqual({ value: " to the " });
    expect(result[4]).toEqual({ value: "market", hint: hints[2] });
  });

  it("handles same word repeated at different positions", () => {
    const text = "the cat and the dog";
    const hints: WordHint[] = [
      { text: "the", translation: "o (primeiro)", startIndex: 0, endIndex: 3 },
      { text: "the", translation: "o (segundo)", startIndex: 12, endIndex: 15 },
    ];
    const result = segmentTextByIndex(text, hints);

    const hinted = result.filter((s) => s.hint);
    expect(hinted).toHaveLength(2);
    expect(hinted[0].hint!.translation).toBe("o (primeiro)");
    expect(hinted[1].hint!.translation).toBe("o (segundo)");
  });

  it("handles overlapping hints by taking first", () => {
    const text = "I am going now";
    const hints: WordHint[] = [
      { text: "am going", translation: "estou indo", startIndex: 2, endIndex: 10 },
      { text: "going", translation: "indo", startIndex: 5, endIndex: 10 },
    ];
    const result = segmentTextByIndex(text, hints);
    const hinted = result.filter((s) => s.hint);
    expect(hinted).toHaveLength(1);
    expect(hinted[0].value).toBe("am going");
  });

  it("returns plain text for empty hints", () => {
    expect(segmentTextByIndex("hello", [])).toEqual([{ value: "hello" }]);
  });
});

// ─── LEGACY REGEX SEGMENTATION ───

describe("segmentText (regex fallback)", () => {
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

  it("prioritizes longer expressions over shorter words", () => {
    const result = segmentText("I am going to the market", hints);
    const amGoingSegment = result.find((s) => s.value.toLowerCase() === "am going");
    expect(amGoingSegment?.hint?.translation).toBe("estou indo");
  });

  it("case-insensitive matching", () => {
    const result = segmentText("i AM GOING to THE MARKET", hints);
    const matched = result.filter((s) => s.hint);
    expect(matched.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── AUTO-DETECT MODE ───

describe("segmentText (auto-detect)", () => {
  it("uses index mode when all hints have indices", () => {
    const text = "hello world";
    const hints: WordHint[] = [
      { text: "hello", translation: "olá", startIndex: 0, endIndex: 5 },
    ];
    const result = segmentText(text, hints);
    expect(result[0]).toEqual({ value: "hello", hint: hints[0] });
    expect(result[1]).toEqual({ value: " world" });
  });

  it("falls back to regex when hints lack indices", () => {
    const text = "hello world";
    const hints: WordHint[] = [{ text: "hello", translation: "olá" }];
    const result = segmentText(text, hints);
    expect(result.some((s) => s.hint?.translation === "olá")).toBe(true);
  });
});

// ─── VALIDATION ───

describe("validateHintIndices", () => {
  it("reports valid for correct indices", () => {
    const text = "I am going to the market";
    const hints: WordHint[] = [
      { text: "am going", translation: "estou indo", startIndex: 2, endIndex: 10 },
    ];
    const result = validateHintIndices(text, hints);
    expect(result[0].valid).toBe(true);
  });

  it("reports invalid when text changed", () => {
    const newText = "I was going to the market";
    const hints: WordHint[] = [
      { text: "am going", translation: "estou indo", startIndex: 2, endIndex: 10 },
    ];
    const result = validateHintIndices(newText, hints);
    expect(result[0].valid).toBe(false);
    expect(result[0].foundText).toBe("was goin");
  });

  it("reports invalid for out-of-bounds indices", () => {
    const text = "Hi";
    const hints: WordHint[] = [
      { text: "hello", translation: "olá", startIndex: 0, endIndex: 50 },
    ];
    const result = validateHintIndices(text, hints);
    expect(result[0].valid).toBe(false);
  });
});

// ─── REVALIDATION ───

describe("revalidateHints", () => {
  it("keeps hints when text at position still matches", () => {
    const text = "I am going to the market";
    const hints: WordHint[] = [
      { text: "market", translation: "mercado", startIndex: 18, endIndex: 24 },
    ];
    const result = revalidateHints(text, hints);
    expect(result[0].startIndex).toBe(18);
    expect(result[0].endIndex).toBe(24);
  });

  it("relocates hint when text moved", () => {
    const newText = "Now I am going to the market";
    const hints: WordHint[] = [
      { text: "market", translation: "mercado", startIndex: 18, endIndex: 24 },
    ];
    const result = revalidateHints(newText, hints);
    expect(result[0].startIndex).toBe(22);
    expect(result[0].endIndex).toBe(28);
  });

  it("strips indices when text no longer found", () => {
    const newText = "I like apples";
    const hints: WordHint[] = [
      { text: "market", translation: "mercado", startIndex: 18, endIndex: 24 },
    ];
    const result = revalidateHints(newText, hints);
    expect(result[0].startIndex).toBeUndefined();
    expect(result[0].endIndex).toBeUndefined();
    expect(result[0].translation).toBe("mercado"); // translation preserved
  });
});

// ─── BACKWARD COMPAT ───

describe("hasWordHints", () => {
  it("returns false for null/undefined/empty", () => {
    expect(hasWordHints(null)).toBe(false);
    expect(hasWordHints(undefined)).toBe(false);
    expect(hasWordHints([])).toBe(false);
  });

  it("returns true for valid hints", () => {
    expect(hasWordHints([{ text: "hello", translation: "olá" }])).toBe(true);
  });
});

describe("backward compatibility", () => {
  it("old card without word_hints renders normally", () => {
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

  it("old hints without indices still work via regex", () => {
    const hints: WordHint[] = [{ text: "hello", translation: "olá" }];
    const result = segmentText("Say hello to everyone", hints);
    expect(result.some((s) => s.hint?.translation === "olá")).toBe(true);
  });

  it("new hints with indices use exact binding", () => {
    const text = "hello hello";
    const hints: WordHint[] = [
      { text: "hello", translation: "first", startIndex: 0, endIndex: 5 },
      { text: "hello", translation: "second", startIndex: 6, endIndex: 11 },
    ];
    const result = segmentText(text, hints);
    const hinted = result.filter((s) => s.hint);
    expect(hinted[0].hint!.translation).toBe("first");
    expect(hinted[1].hint!.translation).toBe("second");
  });
});
