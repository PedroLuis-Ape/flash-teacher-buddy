import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { validateGlobalImportInput } from "./validation";

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
            { key: "to-be-identity", front: "to be", back: "ser", context_tag: "identidade" },
            { key: "to-be-state", front: "to be", back: "estar", context_tag: "estado" },
          ],
        }],
      }],
    }],
  },
};

describe("layered super import flow", () => {
  it("keeps the layered group in the validated smart package", () => {
    const validation = validateGlobalImportInput(source, null);

    expect(validation.valid).toBe(true);
    expect(validation.sourceFormat).toBe("smart");
    expect(validation.smartPackage?.declared_totals?.layered_groups).toBe(1);
    expect(validation.smartPackage?.package.folders[0].lists[0].cards).toHaveLength(1);
    expect(validation.smartPackage?.package.folders[0].lists[0].cards[0]).toMatchObject({
      type: "layered",
      key: "to-be",
      group_title: "to be",
    });
    expect(validation.smartPackage?.package.folders[0].lists[0].cards[0].type === "layered"
      ? validation.smartPackage.package.folders[0].lists[0].cards[0].layers
      : []).toHaveLength(2);
  });

  it("keeps the legacy projection only as a playable compatibility view", () => {
    const validation = validateGlobalImportInput(source, null);

    expect(validation.package?.package.folders[0].lists[0].cards).toHaveLength(2);
    expect(validation.smartPackage?.package.folders[0].lists[0].cards).toHaveLength(1);
  });
});
