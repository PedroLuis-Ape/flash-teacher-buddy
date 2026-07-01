import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { validateGlobalImportInput } from "./validation";

describe("layered super import preservation", () => {
  it("keeps a valid layered payload intact instead of flattening it", () => {
    const source: SmartImportPackage = {
      schema: "app-piteco-super-import",
      version: "2.0",
      declared_totals: {
        folders: 1,
        lists: 1,
        cards: 2,
        glossary_entries: 0,
        layered_groups: 1,
      },
      package: {
        name: "To be",
        folders: [{
          name: "Verbos",
          lists: [{
            name: "To be",
            front_language: "en",
            back_language: "pt-BR",
            primary_side: "a",
            study_type: "language",
            tts_enabled: true,
            glossary: [],
            cards: [{
              type: "layered",
              key: "to-be",
              group_title: "to be",
              layers: [
                { key: "to-be-ser", front: "to be", back: "ser", context_tag: "identidade" },
                { key: "to-be-estar", front: "to be", back: "estar", context_tag: "estado" },
              ],
            }],
          }],
        }],
      },
    };

    const validation = validateGlobalImportInput(source, null);
    const card = validation.smartPackage?.package.folders[0].lists[0].cards[0];

    expect(validation.valid).toBe(true);
    expect(validation.smartPackage?.declared_totals?.layered_groups).toBe(1);
    expect(card?.type).toBe("layered");
    if (card?.type === "layered") {
      expect(card.group_title).toBe("to be");
      expect(card.layers).toHaveLength(2);
      expect(card.layers.map((layer) => layer.back)).toEqual(["ser", "estar"]);
    }
  });
});
