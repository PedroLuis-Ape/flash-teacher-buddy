import { describe, it, expect } from "vitest";
import { levenshtein, pickSmartDistractors } from "./smartDistractors";

describe("levenshtein", () => {
  it("computes basic edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });
});

describe("pickSmartDistractors", () => {
  it("excludes exact (case/accent-insensitive) matches", () => {
    const out = pickSmartDistractors("Olá", ["olá", "ola", "tchau", "oi"], 3);
    expect(out).not.toContain("olá");
    expect(out).not.toContain("ola");
  });

  it("returns the requested count when enough candidates exist", () => {
    const out = pickSmartDistractors("hello", ["hallo", "world", "yellow", "help"], 3);
    expect(out).toHaveLength(3);
  });

  it("prefers similar-but-not-identical candidates over very-different ones", () => {
    // 'casa' vs 'cama' (1 edit), 'caro' (1 edit), 'computador' (very far)
    const out = pickSmartDistractors("casa", ["cama", "caro", "computador"], 2);
    expect(out).toContain("cama");
    expect(out).toContain("caro");
    expect(out).not.toContain("computador");
  });
});