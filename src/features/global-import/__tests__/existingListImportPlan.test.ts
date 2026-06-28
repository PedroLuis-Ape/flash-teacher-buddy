import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import {
  buildExistingListImportPlan,
  reconcileExistingListCards,
} from "../existingListImportPlan";
import { buildQuickListDestinationPlan } from "../quickListDestination";

const source = {
  schema: "app-piteco-super-import",
  version: "2.0",
  package: {
    name: "Test",
    declared_totals: { folders: 1, lists: 2, cards: 2, glossary_entries: 2 },
    folders: [{
      name: "Source",
      declared_totals: { lists: 2, cards: 2, glossary_entries: 2 },
      lists: [
        {
          name: "One", front_language: "en", back_language: "pt", primary_side: "a",
          study_type: "language", tts_enabled: true,
          declared_totals: { cards: 1, glossary_entries: 1 },
          glossary: [{ term: "hello", translation: "ola", side: "A", active: true }],
          cards: [{ type: "normal", front: "Hello", back: "Ola" }],
        },
        {
          name: "Two", front_language: "en", back_language: "pt", primary_side: "a",
          study_type: "language", tts_enabled: true,
          declared_totals: { cards: 1, glossary_entries: 1 },
          glossary: [{ term: "hello", translation: "ola", side: "A", active: true }],
          cards: [{ type: "normal", front: "Bye", back: "Tchau" }],
        },
      ],
    }],
  },
} as SmartImportPackage;

const target = {
  listId: "target-list", folderId: "target-folder", listName: "Target", folderName: "Folder",
  frontLanguage: "en-US", backLanguage: "pt-BR", labelA: "English", labelB: "Portuguese",
  primarySide: "a" as const, studyType: "language" as const, ttsEnabled: false,
};

describe("existing list import plans", () => {
  it("keeps every card and deduplicates glossary entries", () => {
    const result = buildExistingListImportPlan(source, target);
    expect(result.summary.sourceLists).toBe(2);
    expect(result.summary.cardsReceived).toBe(2);
    expect(result.summary.cardsCompatible).toBe(2);
    expect(result.summary.cardsBlocked).toBe(0);
    expect(result.summary.glossaryToImport).toBe(1);
    expect(result.packageValue.package.folders[0].lists[0].cards).toHaveLength(2);
  });

  it("reconciles received cards without making any card disappear", () => {
    const reconciliation = reconcileExistingListCards(source, target, [
      { term: "Hello", translation: "Ola" },
    ]);
    expect(reconciliation).toEqual({
      cardsReceived: 2,
      cardsValid: 1,
      cardsDuplicates: 1,
      cardsBlocked: 0,
      coherent: true,
    });
  });

  it("counts cards from an incompatible source list as blocked", () => {
    const incompatible = structuredClone(source);
    incompatible.package.folders[0].lists[1].front_language = "pt";
    incompatible.package.folders[0].lists[1].back_language = "en";

    const plan = buildExistingListImportPlan(incompatible, target);
    const reconciliation = reconcileExistingListCards(incompatible, target, []);
    expect(plan.errors).toHaveLength(1);
    expect(plan.summary.cardsBlocked).toBe(1);
    expect(reconciliation).toMatchObject({
      cardsReceived: 2,
      cardsValid: 1,
      cardsDuplicates: 0,
      cardsBlocked: 1,
      coherent: true,
    });
  });

  it("maps every incoming list to the same destination", () => {
    const legacy = buildExistingListImportPlan(source, target).packageValue;
    legacy.package.folders[0].lists.push({ name: "Extra", cards: [{ front: "A", back: "B" }] });
    const plan = buildQuickListDestinationPlan(legacy, target.folderId, target.listId, "replace");
    expect(plan?.folders[0].lists[0]).toMatchObject({ strategy: "replace", consolidate: true });
    expect(plan?.folders[0].lists[1]).toMatchObject({ strategy: "append", consolidate: true });
  });
});
