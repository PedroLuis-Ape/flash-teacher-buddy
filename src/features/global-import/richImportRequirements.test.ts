import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { richImportRequirements } from "./richImportRequirements";

function packageWith(cards: any[], glossary: any[] = []): SmartImportPackage {
  return {
    schema: "app-piteco-super-import",
    version: "2.0",
    declared_totals: {
      folders: 1,
      lists: 1,
      cards: cards.reduce((total, card) => total + (card.type === "layered" ? card.layers.length : 1), 0),
      glossary_entries: glossary.length,
      layered_groups: cards.filter((card) => card.type === "layered").length,
    },
    package: {
      name: "Teste",
      folders: [{
        name: "Pasta",
        lists: [{
          name: "Lista",
          front_language: "en",
          back_language: "pt-BR",
          primary_side: "a",
          study_type: "language",
          tts_enabled: true,
          glossary,
          cards,
        }],
      }],
    },
  } as SmartImportPackage;
}

describe("richImportRequirements", () => {
  it("allows legacy fallback only for plain A/B cards", () => {
    expect(richImportRequirements(packageWith([
      { type: "normal", front: "Hello", back: "Olá" },
    ]))).toEqual([]);
  });

  it("blocks legacy fallback for layered cards", () => {
    expect(richImportRequirements(packageWith([{
      type: "layered",
      group_title: "work",
      layers: [
        { front: "I work.", back: "Eu trabalho." },
        { front: "I worked.", back: "Eu trabalhei." },
      ],
    }]))).toContain("cards em camadas");
  });

  it("blocks legacy fallback for glossary and enriched card data", () => {
    expect(richImportRequirements(packageWith(
      [{ type: "normal", front: "Hello", back: "Olá", word_hints: [{ text: "Hello", translation: "Olá", side: "A", occurrence: "all" }] }],
      [{ term: "Hello", translation: "Olá", side: "A", active: true }],
    )).sort()).toEqual(["campos enriquecidos", "glossário"].sort());
  });
});