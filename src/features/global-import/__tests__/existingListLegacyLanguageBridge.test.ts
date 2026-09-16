import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import {
  buildExistingListImportPlan,
  existingListTargetFromCatalog,
} from "../existingListImportPlan";

const source = {
  schema: "app-piteco-super-import",
  version: "2.0",
  package: {
    name: "Legacy bridge",
    source_language: "en",
    target_language: "pt-BR",
    declared_totals: { folders: 1, lists: 1, cards: 1, glossary_entries: 0 },
    folders: [{
      name: "Source",
      declared_totals: { lists: 1, cards: 1, glossary_entries: 0 },
      lists: [{
        name: "Incoming",
        front_language: "en",
        back_language: "pt-BR",
        primary_side: "a",
        study_type: "language",
        tts_enabled: true,
        declared_totals: { cards: 1, glossary_entries: 0 },
        glossary: [],
        cards: [{ type: "normal", front: "Stay focused.", back: "Mantenha o foco." }],
      }],
    }],
  },
} as unknown as SmartImportPackage;

describe("existing-list legacy language bridge", () => {
  it("keeps en/pt stored on an old list when the folder legacy heuristic points pt/en", () => {
    const target = existingListTargetFromCatalog({
      folders: [{
        id: "folder",
        title: "Folder",
        lang_a: "pt-BR",
        lang_b: "en",
        labels_a: "Português",
        labels_b: "English",
      }],
      lists: [{
        id: "list",
        title: "Old list",
        folder_id: "folder",
        lang_a: "en",
        lang_b: "pt",
        labels_a: "English",
        labels_b: "Português",
        language_settings_mode: "legacy",
      }],
    }, "list");

    expect(target).not.toBeNull();
    expect(target).toMatchObject({
      frontLanguage: "pt-BR",
      backLanguage: "en",
      rawFrontLanguage: "en",
      rawBackLanguage: "pt",
      languageSettingsMode: "legacy",
    });

    const result = buildExistingListImportPlan(source, target!);
    expect(result.errors).toEqual([]);
    expect(result.summary.cardsBlocked).toBe(0);
    expect(result.target.frontLanguage).toBe("en");
    expect(result.target.backLanguage).toBe("pt");
    expect(result.packageValue.package.source_language).toBe("en");
    expect(result.packageValue.package.target_language).toBe("pt");
    expect(result.warnings.some((warning) => warning.includes("compatibilidade antiga"))).toBe(true);
  });
});
