import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { flattenSuperImportLayers } from "./flattenSuperImportLayers";

function packageWithLayers(): SmartImportPackage {
  return {
    schema: "app-piteco-super-import",
    version: "2.0",
    declared_totals: {
      folders: 1,
      lists: 1,
      cards: 3,
      glossary_entries: 0,
      layered_groups: 1,
    },
    package: {
      name: "Teste",
      folders: [{
        name: "Verbos",
        lists: [{
          name: "Interpretações",
          front_language: "en",
          back_language: "pt-BR",
          primary_side: "a",
          study_type: "language",
          tts_enabled: true,
          glossary: [],
          cards: [
            { type: "normal", front: "work", back: "trabalhar" },
            {
              type: "layered",
              group_title: "to be",
              layers: [
                { front: "to be", back: "ser", context_tag: "identidade" },
                { front: "to be", back: "estar", context_tag: "estado" },
              ],
            },
          ],
        }],
      }],
    },
  };
}

describe("flattenSuperImportLayers", () => {
  it("turns every layer into an independent normal card", () => {
    const result = flattenSuperImportLayers(packageWithLayers());
    const cards = result.packageValue.package.folders[0].lists[0].cards;

    expect(result.groupsFlattened).toBe(1);
    expect(result.cardsCreated).toBe(2);
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.type === "normal")).toBe(true);
    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "normal", front: "to be", back: "ser" }),
      expect.objectContaining({ type: "normal", front: "to be", back: "estar" }),
    ]));
  });

  it("recalculates declared totals after flattening", () => {
    const result = flattenSuperImportLayers(packageWithLayers());

    expect(result.packageValue.declared_totals).toEqual({
      folders: 1,
      lists: 1,
      cards: 3,
      glossary_entries: 0,
      layered_groups: 0,
    });
  });

  it("keeps normal-only packages unchanged", () => {
    const value = packageWithLayers();
    value.package.folders[0].lists[0].cards = [
      { type: "normal", front: "to be", back: "ser" },
      { type: "normal", front: "to be", back: "estar" },
    ];

    const result = flattenSuperImportLayers(value);

    expect(result.groupsFlattened).toBe(0);
    expect(result.cardsCreated).toBe(0);
    expect(result.packageValue.declared_totals?.layered_groups).toBe(0);
  });
});
