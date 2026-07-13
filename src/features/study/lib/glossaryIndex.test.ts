import { describe, expect, it } from "vitest";
import { buildGlossaryIndex, findRelevantGlossaryMatches } from "./glossaryIndex";
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
    expect(matches[0].translationText).toBe("o, a, os, as");
  });

  it("keeps reverse alternatives indexed", () => {
    const matches = findRelevantGlossaryMatches(
      "Eu sou Pedro e estou em casa.",
      "B",
      [entry("am", "sou, estou")],
    );

    expect(matches.map((match) => match.matchText)).toEqual(expect.arrayContaining(["sou", "estou"]));
  });

  it("matches straight and typographic apostrophes as the same word", () => {
    const matches = findRelevantGlossaryMatches(
      "Millions don’t know.",
      "A",
      [entry("don't", "não")],
    );

    expect(matches).toEqual([
      expect.objectContaining({ matchText: "don't", translationText: "não" }),
    ]);
  });

  it("matches typographic hyphen variants as the same term", () => {
    const matches = findRelevantGlossaryMatches(
      "Long‑term learning matters.",
      "A",
      [entry("long-term", "de longo prazo")],
    );

    expect(matches).toEqual([
      expect.objectContaining({ matchText: "long-term", translationText: "de longo prazo" }),
    ]);
  });

  it("reuses the built index while the glossary reference is unchanged", () => {
    const glossary = [entry("run", "correr")];

    expect(buildGlossaryIndex(glossary)).toBe(buildGlossaryIndex(glossary));
  });

  it("deduplicates repeated normalized candidates", () => {
    const glossary = [
      entry("run", "Correr"),
      entry("run", " correr "),
      entry("run", "CORRER"),
    ];

    const matches = findRelevantGlossaryMatches("run", "A", glossary);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(expect.objectContaining({ translationText: "Correr" }));
  });

  it("handles a 34,000-entry glossary without returning unrelated rows", () => {
    const glossary = Array.from({ length: 34_000 }, (_, index) =>
      entry(`term${index}`, `tradução${index}`),
    );
    glossary.push(entry("replica", "réplica, cópia"));

    const matches = findRelevantGlossaryMatches("A digital replica.", "A", glossary);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchText).toBe("replica");
    expect(matches[0].translationText).toBe("réplica, cópia");
  });
});
