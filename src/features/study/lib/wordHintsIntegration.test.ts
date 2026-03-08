/**
 * Tests for word hints integration and offline store.
 */
import { describe, it, expect } from "vitest";
import { segmentText, parseWordHints } from "@/features/study/lib/wordHints";

// ===== WORD HINTS IN STUDY MODES =====

describe("Word Hints — segmentText for study modes", () => {
  it("renders phrase with single word hint", () => {
    const hints = [{ text: "market", translation: "mercado" }];
    const segs = segmentText("I went to the market.", hints);
    const hintedSegs = segs.filter(s => s.hint);
    expect(hintedSegs).toHaveLength(1);
    expect(hintedSegs[0].value).toBe("market");
    expect(hintedSegs[0].hint?.translation).toBe("mercado");
  });

  it("renders phrase with multi-word expression", () => {
    const hints = [{ text: "am going", translation: "estou indo" }];
    const segs = segmentText("I am going to school.", hints);
    const hintedSegs = segs.filter(s => s.hint);
    expect(hintedSegs).toHaveLength(1);
    expect(hintedSegs[0].value).toBe("am going");
  });

  it("prioritizes longer expression over shorter word", () => {
    const hints = [
      { text: "am going", translation: "estou indo" },
      { text: "going", translation: "indo" },
    ];
    const segs = segmentText("I am going to school.", hints);
    const hintedSegs = segs.filter(s => s.hint);
    // "am going" should be matched, not "going" separately
    expect(hintedSegs).toHaveLength(1);
    expect(hintedSegs[0].value).toBe("am going");
    expect(hintedSegs[0].hint?.translation).toBe("estou indo");
  });

  it("handles punctuation correctly", () => {
    const hints = [{ text: "market", translation: "mercado" }];
    const segs = segmentText("I went to the market, then home.", hints);
    const hintedSegs = segs.filter(s => s.hint);
    expect(hintedSegs).toHaveLength(1);
    expect(hintedSegs[0].value).toBe("market");
  });

  it("card without word_hints returns plain text", () => {
    const segs = segmentText("Hello world", []);
    expect(segs).toHaveLength(1);
    expect(segs[0].value).toBe("Hello world");
    expect(segs[0].hint).toBeUndefined();
  });

  it("parseWordHints returns empty for null/undefined", () => {
    expect(parseWordHints(null)).toEqual([]);
    expect(parseWordHints(undefined)).toEqual([]);
    expect(parseWordHints("bad data")).toEqual([]);
  });

  it("multiple hints in same phrase all resolve", () => {
    const hints = [
      { text: "I", translation: "eu" },
      { text: "market", translation: "mercado" },
    ];
    const segs = segmentText("I went to the market.", hints);
    const hintedSegs = segs.filter(s => s.hint);
    expect(hintedSegs).toHaveLength(2);
  });
});

// ===== OFFLINE STORE =====

describe("Offline Store types", () => {
  it("OfflineListData interface is importable", async () => {
    const mod = await import("@/lib/offlineStore");
    // Just check the functions exist
    expect(typeof mod.saveOfflineList).toBe("function");
    expect(typeof mod.getOfflineList).toBe("function");
    expect(typeof mod.removeOfflineList).toBe("function");
    expect(typeof mod.isListAvailableOffline).toBe("function");
    expect(typeof mod.getAllOfflineListIds).toBe("function");
    expect(typeof mod.getOfflineStatus).toBe("function");
  });
});
