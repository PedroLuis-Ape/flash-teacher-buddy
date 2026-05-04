import { describe, it, expect, vi } from "vitest";
import {
  parsePastedFlashcards,
  parseGlossaryAndCards,
  findSeparatorIndexV2,
  deduplicateFlashcards,
} from "./bulkImport";

// ─── findSeparatorIndexV2 ───────────────────────────────────────────
describe("findSeparatorIndexV2", () => {
  it("prefers ' / '", () => {
    expect(findSeparatorIndexV2("a / b")).toEqual({ index: 1, length: 3 });
  });
  it("accepts ' | '", () => {
    expect(findSeparatorIndexV2("a | b")).toEqual({ index: 1, length: 3 });
  });
  it("accepts ' => '", () => {
    expect(findSeparatorIndexV2("a => b")).toEqual({ index: 1, length: 4 });
  });
  it("accepts em-dash ' — '", () => {
    expect(findSeparatorIndexV2("a — b").index).toBe(1);
  });
  it("accepts en-dash ' – '", () => {
    expect(findSeparatorIndexV2("a – b").index).toBe(1);
  });
  it("accepts ' - '", () => {
    expect(findSeparatorIndexV2("hello - olá").index).toBe(5);
  });
  it("accepts tab", () => {
    expect(findSeparatorIndexV2("a\tb")).toEqual({ index: 1, length: 1 });
  });
  it("does not split on hyphen inside word ('self-care')", () => {
    // Falls back to legacy: no spaced separator, no plain '/', returns -1.
    expect(findSeparatorIndexV2("self-care").index).toBe(-1);
  });
  it("priority: ' / ' wins over ' | '", () => {
    expect(findSeparatorIndexV2("a / b | c")).toEqual({ index: 1, length: 3 });
  });
});

// ─── parsePastedFlashcards (legacy default) ─────────────────────────
describe("parsePastedFlashcards (legacy, flag off)", () => {
  it("parses ' / ' separator", () => {
    const r = parsePastedFlashcards("hello / olá");
    expect(r).toHaveLength(1);
    expect(r[0].sideA).toBe("hello");
    expect(r[0].sideB).toBe("olá");
  });
  it("strips numbering '1. '", () => {
    const r = parsePastedFlashcards("1. hello / olá");
    expect(r[0].sideA).toBe("hello");
  });
  it("extracts (obs) and [hint]", () => {
    const r = parsePastedFlashcards("hello / olá (informal) [greeting]");
    expect(r[0].sideB).toBe("olá");
    expect(r[0].shortObservation).toBe("informal");
    expect(r[0].detailedHint).toBe("greeting");
  });
  it("does NOT split on ' - ' when flag is off", () => {
    const r = parsePastedFlashcards("hello - olá");
    // legacy parser keeps the whole line as sideA
    expect(r[0].sideA).toBe("hello - olá");
    expect(r[0].sideB).toBeUndefined();
  });
});

// ─── parsePastedFlashcards (v2 enabled) ─────────────────────────────
describe("parsePastedFlashcards (v2, flag on)", () => {
  it("splits on ' - ' when v2 is enabled", async () => {
    vi.resetModules();
    vi.doMock("@/lib/featureFlags", () => ({
      FEATURE_FLAGS: { bulk_import_v2: true },
    }));
    const { parsePastedFlashcards: p } = await import("./bulkImport");
    const r = p("hello - olá");
    expect(r[0].sideA).toBe("hello");
    expect(r[0].sideB).toBe("olá");
    vi.resetModules();
    vi.doUnmock("@/lib/featureFlags");
  });

  it("splits on ' | '", async () => {
    vi.resetModules();
    vi.doMock("@/lib/featureFlags", () => ({
      FEATURE_FLAGS: { bulk_import_v2: true },
    }));
    const { parsePastedFlashcards: p } = await import("./bulkImport");
    const r = p("hello | olá");
    expect(r[0].sideA).toBe("hello");
    expect(r[0].sideB).toBe("olá");
    vi.resetModules();
    vi.doUnmock("@/lib/featureFlags");
  });

  it("splits on tab (TSV row)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/featureFlags", () => ({
      FEATURE_FLAGS: { bulk_import_v2: true },
    }));
    const { parsePastedFlashcards: p } = await import("./bulkImport");
    const r = p("hello\tolá");
    expect(r[0].sideA).toBe("hello");
    expect(r[0].sideB).toBe("olá");
    vi.resetModules();
    vi.doUnmock("@/lib/featureFlags");
  });
});

// ─── parseGlossaryAndCards ──────────────────────────────────────────
describe("parseGlossaryAndCards", () => {
  it("respects === markers", () => {
    const input = `=== GLOSSÁRIO GLOBAL ===
work / trabalhar
=== CARDS ===
I work / Eu trabalho`;
    const { glossaryLines, cards } = parseGlossaryAndCards(input);
    expect(glossaryLines).toHaveLength(1);
    expect(cards).toHaveLength(1);
  });
  it("treats whole input as cards when no markers", () => {
    const { glossaryLines, cards } = parseGlossaryAndCards("a / b\nc / d");
    expect(glossaryLines).toHaveLength(0);
    expect(cards).toHaveLength(2);
  });
});

// ─── deduplicateFlashcards ──────────────────────────────────────────
describe("deduplicateFlashcards", () => {
  it("removes case-insensitive duplicates against existing", () => {
    const r = deduplicateFlashcards(
      [{ sideA: "Hello", sideB: "Olá" }],
      [{ term: "hello", translation: "olá" }]
    );
    expect(r).toHaveLength(0);
  });
  it("keeps incomplete pairs for review", () => {
    const r = deduplicateFlashcards([{ sideA: "lonely" }], []);
    expect(r).toHaveLength(1);
  });
});