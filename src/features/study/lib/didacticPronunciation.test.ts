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

  it("preserves word-by-word playback for ordinary words", () => {
    const plan = buildDidacticSpeechPlan("hello world", "en-US");

    expect(plan.map((step) => step.text)).toEqual(["hello", "world"]);
    expect(plan.every((step) => step.kind === "word")).toBe(true);
  });
});
