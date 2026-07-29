import { describe, expect, it } from "vitest";
import { smartImportPackageSchema, withSmartDeclaredTotals } from "./schema";
import {
  detectFlashcardPackageFeatures,
  isValidGlossaryEntry,
  isValidLayeredCard,
} from "./packageFeatures";

function packageValue() {
  return smartImportPackageSchema.parse(withSmartDeclaredTotals({
    schema: "app-piteco-super-import",
    version: "2.0",
    package: {
      name: "Pacote de teste",
      folders: [{
        name: "Pasta",
        lists: [{
          name: "Lista",
          front_language: "en",
          back_language: "pt-BR",
          primary_side: "a",
          study_type: "language",
          glossary: [],
          cards: [
            { type: "normal", front: "Hello", back: "Ola", key: "hello", word_hints: [] },
            { type: "layered", group_title: "get", layers: [
              { front: "get up", back: "levantar", detailed_explanation: "phrasal verb" },
              { front: "get over", back: "superar", tags: ["verb"] },
            ] },
          ],
        }],
      }],
    },
  }));
}

describe("detectFlashcardPackageFeatures", () => {
  it("detects layered and enriched content while ignoring empty glossary arrays", () => {
    const features = detectFlashcardPackageFeatures(packageValue());

    expect(features).toMatchObject({
      hasNormalCards: true,
      hasLayeredCards: true,
      hasEnrichedFields: true,
      hasEmbeddedGlossary: false,
      hasWordHints: false,
      hasMultipleFolders: false,
      hasMultipleLists: false,
      glossaryEntryCount: 0,
    });
  });

  it("accepts only playable layered groups and valid glossary entries", () => {
    const parsed = packageValue();
    const layered = parsed.package.folders[0].lists[0].cards[1];
    expect(isValidLayeredCard(layered)).toBe(true);
    expect(isValidGlossaryEntry({ term: "get", translation: "obter" })).toBe(true);
    expect(isValidGlossaryEntry({ term: "", translation: "obter" })).toBe(false);
  });
});
