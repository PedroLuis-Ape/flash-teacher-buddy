import { describe, expect, it } from "vitest";
import {
  buildDidacticSpeechPlan,
  getDidacticPronunciation,
} from "./didacticPronunciation";

describe("didactic pronunciation", () => {
  it("finds curated English words case-insensitively", () => {
    expect(getDidacticPronunciation("Important!", "en-US")?.display).toBe("im-POR-tənt");
    expect(getDidacticPronunciation("IMPORTANT", "en")?.stressIndex).toBe(1);
  });

  it("does not apply English decompositions to other languages", () => {
    expect(getDidacticPronunciation("important", "pt-BR")).toBeNull();
  });

  it("plays an isolated difficult word as whole, chunks, then whole again", () => {
    const plan = buildDidacticSpeechPlan("important", "en-US");

    expect(plan.map((step) => step.text)).toEqual([
      "important",
      "im",
      "port",
      "ent",
      "important",
    ]);
    expect(plan.map((step) => step.kind)).toEqual([
      "word",
      "chunk",
      "chunk",
      "chunk",
      "review",
    ]);
    expect(plan.at(-1)?.pauseAfterMs).toBe(0);
  });

  it("keeps ordinary words separated while expanding difficult words in a phrase", () => {
    const plan = buildDidacticSpeechPlan("This is important", "en-US");

    expect(plan.map((step) => step.text)).toEqual([
      "This",
      "is",
      "im",
      "port",
      "ent",
      "important",
    ]);
  });

  it("preserves the original word-by-word behavior for unknown words", () => {
    const plan = buildDidacticSpeechPlan("hello world", "en-US");

    expect(plan.map((step) => step.text)).toEqual(["hello", "world"]);
    expect(plan.every((step) => step.kind === "word")).toBe(true);
  });
});
