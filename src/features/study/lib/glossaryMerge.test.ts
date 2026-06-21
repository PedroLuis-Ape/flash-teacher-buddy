import { describe, expect, it } from "vitest";
import { mergeGlossaryAndManual, splitGlossaryAlternatives, type GlossaryItem } from "./glossaryMerge";

const glossary: GlossaryItem[] = [
  {
    original_text: "am",
    translated_text: "sou, estou",
    note: null,
    side: "A",
    is_active: true,
  },
  {
    original_text: "what",
    translated_text: "o que, qual",
    note: null,
    side: "A",
    is_active: true,
  },
];

describe("bidirectional glossary merge", () => {
  it("keeps all common translations on the source side", () => {
    const result = mergeGlossaryAndManual("I am here.", "A", glossary, []);
    expect(result).toEqual([
      expect.objectContaining({
        text: "am",
        translations: [expect.objectContaining({ text: "sou, estou" })],
      }),
    ]);
  });

  it("matches every comma-separated translation on the reverse side", () => {
    const result = mergeGlossaryAndManual("Eu sou Pedro e estou em casa.", "B", glossary, []);
    expect(result.map((hint) => hint.text)).toEqual(expect.arrayContaining(["sou", "estou"]));
    expect(result.find((hint) => hint.text === "sou")?.translations[0].text).toBe("am");
    expect(result.find((hint) => hint.text === "estou")?.translations[0].text).toBe("am");
  });

  it("supports multi-word alternatives in reverse", () => {
    const result = mergeGlossaryAndManual("O que aconteceu e qual é a resposta?", "B", glossary, []);
    expect(result.map((hint) => hint.text)).toEqual(expect.arrayContaining(["o que", "qual"]));
  });

  it("normalizes and deduplicates alternative values", () => {
    expect(splitGlossaryAlternatives(" sou, estou; Sou ")).toEqual(["sou", "estou"]);
  });
});
