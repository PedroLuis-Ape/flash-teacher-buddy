import { describe, expect, it } from "vitest";
import { parseAnySmartImportSource } from "./parseAnySource";
import { buildSmartImportPrompt } from "./prompt";

describe("AI JSON compatibility", () => {
  it("accepts uppercase primary_side and shared metadata on layered groups", () => {
    const source = JSON.stringify({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "Como dizer atender",
        folders: [{
          name: "Pasta",
          lists: [{
            name: "Lista",
            front_language: "en",
            back_language: "pt",
            primary_side: "A",
            study_type: "language",
            glossary: [],
            cards: [{
              type: "layered",
              group_title: "Atender um cliente",
              detailed_explanation: "Help é cotidiano e assist é formal.",
              usage_notes: "Escolha conforme o ambiente.",
              common_mistakes: "Não use attend sem to.",
              layers: [
                { front: "I am helping a customer.", back: "Estou atendendo um cliente." },
                { front: "I am assisting a client.", back: "Estou atendendo um cliente." },
              ],
            }],
          }],
        }],
      },
    });

    const parsed = parseAnySmartImportSource(source);
    const list = parsed.packageValue.package.folders[0].lists[0];
    const group = list.cards[0];

    expect(list.primary_side).toBe("a");
    expect(group.type).toBe("layered");
    if (group.type !== "layered") throw new Error("grupo layered esperado");
    expect(group.layers[0]).toMatchObject({
      detailed_explanation: "Help é cotidiano e assist é formal.",
      usage_notes: "Escolha conforme o ambiente.",
      common_mistakes: "Não use attend sem to.",
    });
    expect(parsed.notes.join(" ")).toContain("primary_side");
  });

  it("makes the strict JSON rules explicit in the generated prompt", () => {
    const prompt = buildSmartImportPrompt({
      outputFormat: "json",
      includeDetailedExplanations: true,
      includeUsageNotes: true,
      includeCommonMistakes: true,
      includeLayeredCards: true,
    });

    expect(prompt).toContain('primary_side aceita exclusivamente "a" ou "b" em minúsculas');
    expect(prompt).toContain("Não coloque esses campos na raiz do grupo layered");
    expect(prompt).toContain("layers: [{ front, back, detailed_explanation?");
  });
});
