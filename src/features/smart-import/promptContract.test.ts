import { describe, expect, it } from "vitest";
import { buildSmartImportPrompt } from "./prompt";

describe("smart import JSON prompt contract", () => {
  it("makes the casing rules and pure JSON requirements explicit", () => {
    const prompt = buildSmartImportPrompt({
      outputFormat: "json",
      includeLayeredCards: true,
      includeGlobalGlossary: true,
      includeContextGlossary: true,
      includeDetailedExplanations: true,
      includeUsageNotes: true,
      includeCommonMistakes: true,
    });

    expect(prompt).toContain('primary_side aceita exclusivamente "a" ou "b" minúsculos');
    expect(prompt).toContain('side do glossary e dos word_hints aceita exclusivamente "A" ou "B" maiúsculos');
    expect(prompt).toContain("Use aspas duplas em todas as chaves e textos");
    expect(prompt).toContain("Não use Markdown");
  });

  it("uses valid JSON examples and keeps layered metadata inside layers", () => {
    const prompt = buildSmartImportPrompt({
      outputFormat: "json",
      includeLayeredCards: true,
    });

    expect(prompt).toContain('"type": "normal"');
    expect(prompt).toContain('"type": "layered"');
    expect(prompt).toContain("Nunca coloque esses campos pedagógicos na raiz do grupo layered");
    expect(prompt).not.toContain("{ type: 'normal'");
    expect(prompt).not.toContain("detailed_explanation?");
  });

  it("forbids layered fields when grouped cards are disabled", () => {
    const prompt = buildSmartImportPrompt({
      outputFormat: "json",
      includeLayeredCards: false,
    });

    expect(prompt).toContain("Não use type layered, group_title nem layers");
  });
});
