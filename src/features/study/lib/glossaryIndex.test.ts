import { describe, expect, it } from "vitest";
import { findRelevantGlossaryMatches } from "./glossaryIndex";
import type { GlossaryItem } from "./glossaryMerge";

function entry(original_text: string, translated_text: string, side: "A" | "B" = "A"): GlossaryItem {
  return { original_text, translated_text, side, note: null, is_active: true };
}

describe("glossary index", () => {
  it("returns only terms whose first token appears in the current card", () => {
    const glossary = [
      entry("the", "o, a, os, as"),
      entry("digital replica", "réplica digital"),
      entry("unrelated", "não relacionado"),
    ];

    const matches = findRelevantGlossaryMatches(
      "The system creates a digital replica.",
      "A",
      glossary,
    );

    expect(matches.map((match) => match.matchText)).toEqual(["the", "digital replica"]);
  });

  it("keeps reverse alternatives indexed", () => {
    const matches = findRelevantGlossaryMatches(
      "Eu sou Pedro e estou em casa.",
      "B",
      [entry("am", "sou, estou")],
    );

    expect(matches.map((match) => match.matchText)).toEqual(expect.arrayContaining(["sou", "estou"]));
  });

  it("handles a 34,000-entry glossary without returning unrelated rows", () => {
    const glossary = Array.from({ length: 34_000 }, (_, index) =>
      entry(`term${index}`, `tradução${index}`),
    );
    glossary.push(entry("replica", "réplica, cópia"));

    const matches = findRelevantGlossaryMatches("A digital replica.", "A", glossary);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchText).toBe("replica");
  });
});
