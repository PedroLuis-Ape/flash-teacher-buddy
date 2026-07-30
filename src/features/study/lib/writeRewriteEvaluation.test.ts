import { describe, expect, it } from "vitest";
import { evaluateRewriteAnswer, normalizeForRewriteCompare } from "./writeRewriteEvaluation";

describe("writeRewriteEvaluation", () => {
  it("accepts an exact rewrite", () => {
    const result = evaluateRewriteAnswer({
      userAnswer: "The company is growing quickly.",
      correctAnswer: "The company is growing quickly.",
    });

    expect(result.status).toBe("exact");
    expect(result.accepted).toBe(true);
  });

  it("rejects changes in casing and punctuation", () => {
    const result = evaluateRewriteAnswer({
      userAnswer: "the company is growing quickly",
      correctAnswer: "The company is growing quickly.",
    });

    expect(result.status).toBe("incorrect");
    expect(result.accepted).toBe(false);
    expect(result.summary).toContain("maiúsculas");
  });

  it("rejects missing accents", () => {
    const result = evaluateRewriteAnswer({
      userAnswer: "Voce esta bem?",
      correctAnswer: "Você está bem?",
    });

    expect(result.status).toBe("incorrect");
    expect(result.accepted).toBe(false);
  });

  it("accepts mobile typographic apostrophes and harmless whitespace", () => {
    const result = evaluateRewriteAnswer({
      userAnswer: "  I don't   know.  ",
      correctAnswer: "I don’t know.",
    });

    expect(result.status).toBe("exact");
    expect(result.accepted).toBe(true);
  });

  it("keeps letters, accents and punctuation in exact normalization", () => {
    expect(normalizeForRewriteCompare("Olá!" )).not.toBe(normalizeForRewriteCompare("ola"));
  });
});
