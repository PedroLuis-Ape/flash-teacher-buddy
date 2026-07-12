import { describe, expect, it } from "vitest";
import {
  cleanFolderGlossaryText,
  compactFolderGlossaryEntries,
  folderGlossaryIdentity,
} from "./folderGlossaryCompact";


describe("folder glossary compaction", () => {
  it("normalizes Unicode punctuation and repeated spaces", () => {
    expect(cleanFolderGlossaryText("  don’t   give–up  ")).toBe("don't give-up");
    expect(folderGlossaryIdentity("Ｔｅｓｔ")).toBe("test");
  });

  it("groups repeated terms on the same side and preserves translations as alternatives", () => {
    const result = compactFolderGlossaryEntries([
      { term: " House ", translation: "Casa", side: "A" },
      { term: "house", translation: "lar", alternatives: ["Residência"], side: "A" },
      { term: "HOUSE", translation: "CASA", alternatives: ["lar"], side: "A" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      term: "House",
      translation: "Casa",
      side: "A",
      alternatives: ["lar", "Residência"],
    }));
  });

  it("keeps equal canonical terms separate when the side changes", () => {
    const result = compactFolderGlossaryEntries([
      { term: "record", translation: "registro", side: "A" },
      { term: "record", translation: "gravar", side: "B" },
    ]);

    expect(result).toHaveLength(2);
  });

  it("drops invalid rows before they reach the database", () => {
    expect(compactFolderGlossaryEntries([
      { term: "", translation: "vazio", side: "A" },
      { term: "valid", translation: "", side: "A" },
      { term: "valid", translation: "válido", side: "A" },
    ])).toEqual([
      expect.objectContaining({ term: "valid", translation: "válido" }),
    ]);
  });
});
