import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { validateGlobalImportInput } from "./validation";
import { flattenSuperImportLayers } from "./flattenSuperImportLayers";

describe("normal-card-only super import flow", () => {
  it("produces a valid package after converting a layered payload", () => {
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
              group_title: "to be",
              layers: [
                { front: "to be", back: "ser", context_tag: "identidade" },
                { front: "to be", back: "estar", context_tag: "estado" },
              ],
            }],
          }],
        }],
      },
    };

    const flattened = flattenSuperImportLayers(source);
    const validation = validateGlobalImportInput(flattened.packageValue, null);

    expect(validation.valid).toBe(true);
    expect(validation.smartPackage?.declared_totals?.layered_groups).toBe(0);
    expect(validation.smartPackage?.package.folders[0].lists[0].cards).toHaveLength(2);
  });
});
