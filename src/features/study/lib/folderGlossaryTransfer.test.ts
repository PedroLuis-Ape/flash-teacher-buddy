import { describe, expect, it } from "vitest";
import { parseFolderGlossaryJson } from "./folderGlossaryTransfer";

describe("folder glossary preserves rejected input", () => {
  it("rejects the whole input instead of silently dropping incomplete entries", () => {
    expect(() => parseFolderGlossaryJson(JSON.stringify([
      { term: "coffee", translation: "café" },
      { term: "dog" },
    ]))).toThrow("posições 2");
  });
  it("keeps valid accented entries and supports the entries envelope", () => {
    expect(parseFolderGlossaryJson('{"entries":[{"term":"coffee","translation":"café"}]}'))
      .toMatchObject([{ term: "coffee", translation: "café" }]);
  });
});
