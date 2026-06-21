import { describe, expect, it } from "vitest";
import {
  buildTextualPronunciationResult,
  normalizePronunciationText,
  resultFromScore,
  textualPronunciationScore,
} from "./pronunciationScoring";

describe("pronunciation text normalization", () => {
  it("ignores punctuation, accents and apostrophe variants", () => {
    expect(normalizePronunciationText("I’m at home!" )).toBe("im at home");
    expect(normalizePronunciationText("Você está bem?" )).toBe("voce esta bem");
  });

  it("treats equivalent normalized phrases as a full match", () => {
    expect(textualPronunciationScore("I'm at home.", "im at home")).toBe(100);
  });

  it("penalizes missing and additional words", () => {
    expect(textualPronunciationScore("I am at home", "I am home")).toBeLessThan(85);
    expect(textualPronunciationScore("I am at home", "I am now at home")).toBeLessThan(100);
  });
});

describe("pronunciation result contract", () => {
  it("uses explicit thresholds", () => {
    expect(resultFromScore(85)).toBe("correct");
    expect(resultFromScore(84)).toBe("almost");
    expect(resultFromScore(64)).toBe("incorrect");
  });

  it("does not claim textual matching is acoustic assessment", () => {
    const result = buildTextualPronunciationResult({
      provider: "openai-transcription",
      expectedText: "Good morning",
      transcript: "Good morning",
    });
    expect(result.assessmentType).toBe("textual");
    expect(result.accuracyScore).toBeNull();
    expect(result.prosodyScore).toBeNull();
    expect(result.warnings.join(" ")).toContain("não a qualidade acústica");
  });
});
