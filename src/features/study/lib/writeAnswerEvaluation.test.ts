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

  it("accepts missing commas, final marks and accents as exact", () => {
    const cases = [
      { userAnswer: "Hello John how are you", correctAnswer: "Hello, John, how are you?" },
      { userAnswer: "Voce esta bem", correctAnswer: "Você está bem?" },
      { userAnswer: "Yes I am", correctAnswer: "Yes! I am." },
      { userAnswer: "Hello John", correctAnswer: "\"Hello, John!\"" },
    ];

    for (const input of cases) {
      const result = evaluateWriteAnswer({ ...hard, ...input });
      expect(result.status).toBe("exact");
      expect(result.accepted).toBe(true);
    }
  });

  it("accepts missing straight or typographic apostrophes", () => {
    const result = evaluateWriteAnswer({
      ...hard,
      userAnswer: "I dont know where Johns book is",
      correctAnswer: "I don’t know where John’s book is.",
    });

    expect(result.status).toBe("exact");
    expect(result.accepted).toBe(true);
  });

  it("treats basic separators and missing spaces consistently", () => {
    const result = evaluateWriteAnswer({
      ...hard,
      userAnswer: "This is a well known fact",
      correctAnswer: "This is a well-known fact.",
    });

    expect(result.status).toBe("exact");
    expect(result.accepted).toBe(true);
  });

  it("does not ignore letters while tolerating punctuation", () => {
    const result = evaluateWriteAnswer({
      ...hard,
      userAnswer: "I do know",
      correctAnswer: "I don't know.",
    });

    expect(result.status).toBe("incorrect");
    expect(result.accepted).toBe(false);
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
