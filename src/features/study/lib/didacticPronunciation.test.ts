import { describe, expect, it } from "vitest";
import {
  buildDidacticSpeechPlan,
  getDidacticPronunciation,
} from "./didacticPronunciation";

describe("didactic pronunciation", () => {
  it("does not expose syllable decompositions", () => {
    expect(getDidacticPronunciation("Important!", "en-US")).toBeNull();
    expect(getDidacticPronunciation("comfortable", "en-US")).toBeNull();
  });

  it("keeps an isolated difficult word intact", () => {
    const plan = buildDidacticSpeechPlan("important", "en-US");

    expect(plan.map((step) => step.text)).toEqual(["important"]);
    expect(plan.every((step) => step.kind === "word")).toBe(true);
    expect(plan[0]?.pauseAfterMs).toBe(0);
  });

  it("separates phrase words without splitting any word into syllables", () => {
    const plan = buildDidacticSpeechPlan("This is important", "en-US");

    expect(plan.map((step) => step.text)).toEqual([
      "This",
      "is",
      "important",
    ]);
    expect(plan.some((step) => ["im", "port", "ent"].includes(step.text))).toBe(false);
  });

  it("pronounces the English pronoun I as a word instead of a capital letter", () => {
    const plan = buildDidacticSpeechPlan("I am at home", "en-US");

    expect(plan.map((step) => step.text)).toEqual(["eye", "am", "at", "home"]);
  });

  it("pronounces the English article a as a word instead of a letter name", () => {
    const plan = buildDidacticSpeechPlan("A good lesson", "en-US");

    expect(plan.map((step) => step.text)).toEqual(["uh", "good", "lesson"]);
  });

  it("does not rewrite one-letter tokens in other languages", () => {
    const plan = buildDidacticSpeechPlan("A casa", "pt-BR");

    expect(plan.map((step) => step.text)).toEqual(["A", "casa"]);
  });

  it("preserves word-by-word playback for ordinary words", () => {
    const plan = buildDidacticSpeechPlan("hello world", "en-US");

    expect(plan.map((step) => step.text)).toEqual(["hello", "world"]);
    expect(plan.every((step) => step.kind === "word")).toBe(true);
  });
});
