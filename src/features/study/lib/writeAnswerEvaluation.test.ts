import { describe, expect, it } from "vitest";
import { evaluateWriteAnswer } from "./writeAnswerEvaluation";

const flexible = { mode: "flexible" as const };
const hard = { mode: "hard" as const };

describe("evaluateWriteAnswer", () => {
  it("marks identical answers as exact in both modes", () => {
    const expected = "My car broke down.";
    for (const opts of [flexible, hard]) {
      const r = evaluateWriteAnswer({ ...opts, userAnswer: "My car broke down.", correctAnswer: expected });
      expect(r.status).toBe("exact");
      expect(r.accepted).toBe(true);
    }
  });

  it("ignores case and terminal punctuation in both modes", () => {
    const r = evaluateWriteAnswer({
      ...hard,
      userAnswer: "my car broke down",
      correctAnswer: "My car broke down.",
    });
    expect(r.status).toBe("exact");
  });

  it("accepts a typo in flexible but rejects it in hard", () => {
    const input = { userAnswer: "The house is beatiful.", correctAnswer: "The house is beautiful." };
    const flex = evaluateWriteAnswer({ ...flexible, ...input });
    expect(flex.status).toBe("accepted_with_corrections");
    expect(flex.accepted).toBe(true);
    expect(flex.differences.some((d) => d.type === "typo")).toBe(true);

    const strict = evaluateWriteAnswer({ ...hard, ...input });
    expect(strict.status).toBe("incorrect");
    expect(strict.accepted).toBe(false);
  });

  it("detects missing, typo and missing article in a longer sentence", () => {
    const r = evaluateWriteAnswer({
      ...flexible,
      userAnswer: "My car broke in the midle of street.",
      correctAnswer: "My car broke down in the middle of the street.",
    });
    const types = r.differences.map((d) => d.type);
    expect(types).toContain("missing"); // "down" and/or "the"
    expect(types).toContain("typo"); // "midle" -> "middle"
  });

  it("does not treat short words as typos of each other", () => {
    const r = evaluateWriteAnswer({
      ...flexible,
      userAnswer: "it",
      correctAnswer: "is",
    });
    expect(r.accepted).toBe(false);
    expect(r.status).toBe("incorrect");
  });

  it("rejects empty answers", () => {
    const r = evaluateWriteAnswer({ ...flexible, userAnswer: "   ", correctAnswer: "hello" });
    expect(r.status).toBe("incorrect");
    expect(r.accepted).toBe(false);
  });

  it("picks the closest alternative as matchedAnswer", () => {
    const r = evaluateWriteAnswer({
      ...flexible,
      userAnswer: "I love apples",
      correctAnswer: "Eu amo maçãs",
      alternatives: ["I love apples", "I like fruit"],
    });
    expect(r.matchedAnswer).toBe("I love apples");
    expect(r.status).toBe("exact");
  });

  it("rejects a mostly wrong sentence in flexible mode", () => {
    const r = evaluateWriteAnswer({
      ...flexible,
      userAnswer: "The dog runs fast",
      correctAnswer: "My car broke down in the middle of the street.",
    });
    expect(r.status).toBe("incorrect");
    expect(r.accepted).toBe(false);
  });
});