import { describe, expect, it } from "vitest";
import { parseFolderGlossaryJson } from "./lib/folderGlossaryTransfer";

describe("folder glossary parser contract", () => {
  it("accepts the official schema fields", () => {
    const result = parseFolderGlossaryJson(JSON.stringify({
      schema: "app-piteco-folder-glossary",
      version: "1.0",
      folder: { name: "Avançado" },
      entries: [{
        term: "could",
        translation: "poderia",
        alternatives: ["podia"],
        note: null,
        side: "A",
        source_language: "English",
        target_language: "Português",
        active: true,
      }],
    }));

    expect(result[0]).toMatchObject({
      term: "could",
      translation: "poderia",
      alternatives: ["podia"],
      side: "A",
      source_language: "English",
      target_language: "Português",
      active: true,
    });
  });
});
