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
      { type: "normal", front: "Hello", back: "Ola" },
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

  it("does not require a glossary capability for empty or invalid entries", () => {
    expect(richImportRequirements(packageWith([
      { type: "normal", front: "Hello", back: "Ola" },
    ], []))).toEqual([]);
    expect(richImportRequirements(packageWith([
      { type: "normal", front: "Hello", back: "Ola" },
    ], [{ term: "", translation: "" }]))).toEqual([]);
  });

  it("requires the rich gateway for real glossary and enriched card data", () => {
    expect(richImportRequirements(packageWith(
      [{ type: "normal", front: "Hello", back: "Ola", word_hints: [{ text: "Hello", translation: "Ola", side: "A", occurrence: "all" }] }],
      [{ term: "Hello", translation: "Ola", side: "A", active: true }],
    ))).toEqual(["campos enriquecidos"]);
  });
});
