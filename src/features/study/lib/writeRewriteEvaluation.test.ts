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

  it("accepts the same neutral tolerances as the regular Write mode", () => {
    const cases = [
      {
        userAnswer: "the company is growing quickly",
        correctAnswer: "The company is growing quickly.",
      },
      {
        userAnswer: "Voce esta bem",
        correctAnswer: "Você está bem?",
      },
      {
        userAnswer: "Hello John how are you",
        correctAnswer: "Hello, John, how are you?",
      },
    ];

    for (const input of cases) {
      const result = evaluateRewriteAnswer(input);
      expect(result.status).toBe("exact");
      expect(result.accepted).toBe(true);
    }
  });

  it("accepts mobile typographic apostrophes and harmless whitespace", () => {
    const result = evaluateRewriteAnswer({
      userAnswer: "  I don't   know.  ",
      correctAnswer: "I don’t know.",
    });

    expect(result.status).toBe("exact");
    expect(result.accepted).toBe(true);
  });

  it("still rejects changed words or changed order", () => {
    const changedWord = evaluateRewriteAnswer({
      userAnswer: "The company is shrinking quickly.",
      correctAnswer: "The company is growing quickly.",
    });
    const changedOrder = evaluateRewriteAnswer({
      userAnswer: "Quickly the company is growing.",
      correctAnswer: "The company is growing quickly.",
    });

    expect(changedWord.accepted).toBe(false);
    expect(changedOrder.accepted).toBe(false);
  });

  it("uses the same comparison normalization as the regular Write mode", () => {
    expect(normalizeForRewriteCompare("Olá!" )).toBe(normalizeForRewriteCompare("ola"));
  });
});
