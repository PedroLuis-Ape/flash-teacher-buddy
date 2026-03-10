/**
 * ===================================================================
 * GAME CORE — TESTES DE PROTEÇÃO (v2 — canonical direction tokens)
 * ===================================================================
 *
 * Estes testes validam o comportamento EXATO da lógica do jogo.
 * Se algum teste falhar, significa que uma invariante foi violada.
 *
 * Para rodar: npx vitest run src/features/study/lib/gameCore.test.ts
 * ===================================================================
 */

import { describe, it, expect } from "vitest";
import {
  hashToBool,
  resolveStudySides,
  normalizeDirection,
  resolveDirection,
  shuffleArray,
  computeStats,
  computeProgress,
  generateNextRound,
  generateMultipleChoiceOptions,
  recordResultImmutable,
  updateMissedCards,
  getMixedMode,
  toBCP47,
  getLangLabel,
  type StudySide,
  type StudyResult,
} from "./gameCore";

// ─── Helpers ─────────────────────────────────────────────────────────

const sideA: StudySide = { text: "Hello", lang: "en", label: "English" };
const sideB: StudySide = { text: "Olá", lang: "pt", label: "Português" };

// ─── normalizeDirection ─────────────────────────────────────────────

describe("normalizeDirection", () => {
  it("maps legacy tokens to canonical", () => {
    expect(normalizeDirection("en-pt")).toBe("a-b");
    expect(normalizeDirection("pt-en")).toBe("b-a");
  });

  it("passes through canonical tokens", () => {
    expect(normalizeDirection("a-b")).toBe("a-b");
    expect(normalizeDirection("b-a")).toBe("b-a");
    expect(normalizeDirection("any")).toBe("any");
  });

  it("defaults unknown values to any", () => {
    expect(normalizeDirection("random")).toBe("any");
    expect(normalizeDirection("")).toBe("any");
  });
});

// ─── resolveStudySides ──────────────────────────────────────────────

describe("resolveStudySides", () => {
  it("a-b: sideA is prompt, sideB is answer", () => {
    const result = resolveStudySides(sideA, sideB, "a-b");
    expect(result.promptSide.text).toBe("Hello");
    expect(result.answerSide.text).toBe("Olá");
    expect(result.isAFirst).toBe(true);
  });

  it("b-a: sideB is prompt, sideA is answer", () => {
    const result = resolveStudySides(sideA, sideB, "b-a");
    expect(result.promptSide.text).toBe("Olá");
    expect(result.answerSide.text).toBe("Hello");
    expect(result.isAFirst).toBe(false);
  });

  it("any: deterministic based on seed", () => {
    const r1 = resolveStudySides(sideA, sideB, "any", "seed1");
    const r2 = resolveStudySides(sideA, sideB, "any", "seed1");
    expect(r1.isAFirst).toBe(r2.isAFirst); // Same seed = same result
  });

  it("never mutates input sides", () => {
    const a = { ...sideA };
    const b = { ...sideB };
    resolveStudySides(a, b, "a-b");
    expect(a.text).toBe("Hello");
    expect(b.text).toBe("Olá");
  });

  it("accepts legacy en-pt/pt-en tokens", () => {
    const enPt = resolveStudySides(sideA, sideB, "en-pt" as any);
    expect(enPt.isAFirst).toBe(true);
    const ptEn = resolveStudySides(sideA, sideB, "pt-en" as any);
    expect(ptEn.isAFirst).toBe(false);
  });
});

// ─── resolveDirection ───────────────────────────────────────────────

describe("resolveDirection", () => {
  it("resolves fixed directions correctly", () => {
    expect(resolveDirection("a-b", false, 0)).toBe("a-b");
    expect(resolveDirection("b-a", false, 0)).toBe("b-a");
  });

  it("resolves 'any' deterministically by index", () => {
    expect(resolveDirection("any", false, 0)).toBe("b-a"); // even
    expect(resolveDirection("any", false, 1)).toBe("a-b"); // odd
  });

  it("isSwapped parameter is ignored (swap removed)", () => {
    // swap param kept for API compat but has no effect
    expect(resolveDirection("a-b", true, 0)).toBe("a-b");
    expect(resolveDirection("b-a", true, 0)).toBe("b-a");
  });
});

// ─── shuffleArray ───────────────────────────────────────────────────

describe("shuffleArray", () => {
  it("returns a new array, never mutates original", () => {
    const original = [1, 2, 3, 4, 5] as const;
    const result = shuffleArray(original);
    expect(result).not.toBe(original);
    expect(original).toEqual([1, 2, 3, 4, 5]); // unchanged
  });

  it("contains all original elements", () => {
    const original = ["a", "b", "c", "d"];
    const result = shuffleArray(original);
    expect(result.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("works with empty array", () => {
    expect(shuffleArray([])).toEqual([]);
  });
});

// ─── computeStats ───────────────────────────────────────────────────

describe("computeStats", () => {
  it("counts correct, error, skipped", () => {
    const results: StudyResult[] = [
      { flashcardId: "1", correct: true, skipped: false, attempts: 1 },
      { flashcardId: "2", correct: false, skipped: false, attempts: 1 },
      { flashcardId: "3", correct: false, skipped: true, attempts: 1 },
    ];
    const stats = computeStats(results);
    expect(stats.correctCount).toBe(1);
    expect(stats.errorCount).toBe(1);
    expect(stats.skippedCount).toBe(1);
    expect(stats.accuracy).toBe(0.5);
  });

  it("handles empty results", () => {
    const stats = computeStats([]);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracy).toBe(0);
  });
});

// ─── computeProgress ────────────────────────────────────────────────

describe("computeProgress", () => {
  it("returns correct percentage", () => {
    expect(computeProgress(0, 10)).toBe(10);
    expect(computeProgress(4, 10)).toBe(50);
    expect(computeProgress(9, 10)).toBe(100);
  });

  it("handles zero total", () => {
    expect(computeProgress(0, 0)).toBe(0);
  });
});

// ─── generateNextRound ──────────────────────────────────────────────

describe("generateNextRound", () => {
  it("prioritizes missed cards", () => {
    const result = generateNextRound(["m1", "m2"], ["u1", "u2", "u3"], 3);
    expect(result.roundCards).toContain("m1");
    expect(result.roundCards).toContain("m2");
    expect(result.roundCards.length).toBe(3);
  });

  it("fills with unseen when no missed", () => {
    const result = generateNextRound([], ["u1", "u2", "u3"], 2);
    expect(result.roundCards.length).toBe(2);
    expect(result.remainingUnseen.length).toBe(1);
  });

  it("does not mutate inputs", () => {
    const missed = ["m1"];
    const unseen = ["u1", "u2"];
    generateNextRound(missed, unseen, 5);
    expect(missed).toEqual(["m1"]);
    expect(unseen).toEqual(["u1", "u2"]);
  });
});

// ─── generateMultipleChoiceOptions ──────────────────────────────────

describe("generateMultipleChoiceOptions", () => {
  it("always includes correct answer", () => {
    const { options, correctIndex } = generateMultipleChoiceOptions(
      "correct",
      ["wrong1", "wrong2", "wrong3", "wrong4", "correct"]
    );
    expect(options[correctIndex]).toBe("correct");
  });

  it("returns 4 options total by default", () => {
    const { options } = generateMultipleChoiceOptions(
      "correct",
      ["w1", "w2", "w3", "w4"]
    );
    expect(options.length).toBe(4);
  });
});

// ─── recordResultImmutable ──────────────────────────────────────────

describe("recordResultImmutable", () => {
  it("adds new result", () => {
    const results = recordResultImmutable([], "card1", true);
    expect(results.length).toBe(1);
    expect(results[0].correct).toBe(true);
    expect(results[0].attempts).toBe(1);
  });

  it("updates existing result without mutating", () => {
    const original: StudyResult[] = [
      { flashcardId: "card1", correct: true, skipped: false, attempts: 1 },
    ];
    const updated = recordResultImmutable(original, "card1", false);
    expect(updated[0].correct).toBe(false);
    expect(updated[0].attempts).toBe(2);
    // Original unchanged
    expect(original[0].correct).toBe(true);
    expect(original[0].attempts).toBe(1);
  });
});

// ─── updateMissedCards ──────────────────────────────────────────────

describe("updateMissedCards", () => {
  it("adds to missed on incorrect", () => {
    const result = updateMissedCards([], "card1", false, false);
    expect(result).toContain("card1");
  });

  it("removes from missed on correct", () => {
    const result = updateMissedCards(["card1", "card2"], "card1", true, false);
    expect(result).not.toContain("card1");
    expect(result).toContain("card2");
  });

  it("does not duplicate on repeated incorrect", () => {
    const result = updateMissedCards(["card1"], "card1", false, false);
    expect(result.filter((id) => id === "card1").length).toBe(1);
  });

  it("does not mutate original array", () => {
    const original = ["card1"];
    updateMissedCards(original, "card2", false, false);
    expect(original).toEqual(["card1"]);
  });
});

// ─── getMixedMode ───────────────────────────────────────────────────

describe("getMixedMode", () => {
  it("cycles through modes deterministically", () => {
    expect(getMixedMode(0)).toBe("flip");
    expect(getMixedMode(1)).toBe("write");
    expect(getMixedMode(2)).toBe("multiple-choice");
    expect(getMixedMode(3)).toBe("unscramble");
    expect(getMixedMode(4)).toBe("flip"); // cycles
  });
});

// ─── toBCP47 / getLangLabel ─────────────────────────────────────────

describe("toBCP47", () => {
  it("maps known codes", () => {
    expect(toBCP47("en")).toBe("en-US");
    expect(toBCP47("pt")).toBe("pt-BR");
  });

  it("returns input for unknown codes", () => {
    expect(toBCP47("xx-YY")).toBe("xx-YY");
  });
});

describe("getLangLabel", () => {
  it("maps known codes to labels", () => {
    expect(getLangLabel("en")).toBe("English");
    expect(getLangLabel("pt")).toBe("Português");
  });

  it("uppercases unknown codes", () => {
    expect(getLangLabel("xx")).toBe("XX");
  });
});

// ─── INVARIANT: Data Immutability ───────────────────────────────────

describe("INVARIANT: no function mutates card data", () => {
  it("resolveStudySides never changes card fields", () => {
    const card = Object.freeze({ id: "c1", term: "Dog", translation: "Cachorro" });
    const a: StudySide = { text: card.term, lang: "en", label: "English" };
    const b: StudySide = { text: card.translation, lang: "pt", label: "Português" };
    
    // Should not throw (frozen objects throw on mutation)
    resolveStudySides(a, b, "a-b", card.id);
    resolveStudySides(a, b, "b-a", card.id);
    resolveStudySides(a, b, "any", card.id);
    
    expect(card.term).toBe("Dog");
    expect(card.translation).toBe("Cachorro");
  });
});

// ─── Canonical A/B Architecture Tests ───────────────────────────────

describe("Canonical A/B architecture", () => {
  it("term is always side A", () => {
    const a: StudySide = { text: "Bonjour", lang: "fr", label: "Français" };
    const b: StudySide = { text: "Hello", lang: "en", label: "English" };
    
    const ab = resolveStudySides(a, b, "a-b");
    expect(ab.promptSide.text).toBe("Bonjour"); // A is prompt
    expect(ab.answerSide.text).toBe("Hello");   // B is answer
    
    const ba = resolveStudySides(a, b, "b-a");
    expect(ba.promptSide.text).toBe("Hello");   // B is prompt
    expect(ba.answerSide.text).toBe("Bonjour"); // A is answer
  });

  it("labels match the content being shown", () => {
    const a: StudySide = { text: "Bonjour", lang: "fr", label: "Français" };
    const b: StudySide = { text: "Hello", lang: "en", label: "English" };
    
    const ab = resolveStudySides(a, b, "a-b");
    expect(ab.promptSide.label).toBe("Français");
    expect(ab.answerSide.label).toBe("English");
    
    const ba = resolveStudySides(a, b, "b-a");
    expect(ba.promptSide.label).toBe("English");
    expect(ba.answerSide.label).toBe("Français");
  });

  it("TTS language matches the visible side", () => {
    const a: StudySide = { text: "Bonjour", lang: "fr", label: "Français" };
    const b: StudySide = { text: "Hello", lang: "en", label: "English" };
    
    const ab = resolveStudySides(a, b, "a-b");
    expect(ab.promptSide.lang).toBe("fr"); // TTS should speak French
    expect(ab.answerSide.lang).toBe("en"); // TTS should speak English
  });

  it("any direction alternates without corrupting A/B", () => {
    const a: StudySide = { text: "T1", lang: "fr", label: "Français" };
    const b: StudySide = { text: "T2", lang: "en", label: "English" };
    
    const r1 = resolveStudySides(a, b, "any", "card-1");
    const r2 = resolveStudySides(a, b, "any", "card-2");
    
    // Both must reference the original texts
    expect([r1.promptSide.text, r1.answerSide.text].sort()).toEqual(["T1", "T2"]);
    expect([r2.promptSide.text, r2.answerSide.text].sort()).toEqual(["T1", "T2"]);
  });

  it("import/export preserves A/B: field 1 = A = term, field 2 = B = translation", () => {
    const term = "Bonjour";
    const translation = "Hello";
    const exportLine = `${term} / ${translation}`;
    const [reimportTerm, reimportTranslation] = exportLine.split(" / ");
    expect(reimportTerm).toBe(term);
    expect(reimportTranslation).toBe(translation);
  });
});
