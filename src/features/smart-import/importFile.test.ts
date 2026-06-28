import { describe, expect, it } from "vitest";
import { SMART_IMPORT_LIMITS } from "./schema";
import { readCompleteImportFile } from "./importFile";

function fakeFile(
  name: string,
  text: string,
  size = new TextEncoder().encode(text).byteLength,
) {
  return {
    name,
    size,
    text: async () => text,
  };
}

describe("readCompleteImportFile", () => {
  it("reads a valid JSON file", async () => {
    await expect(readCompleteImportFile(fakeFile("cards.json", '{"version":"2.0"}')))
      .resolves.toBe('{"version":"2.0"}');
  });

  it("rejects non-JSON files", async () => {
    await expect(readCompleteImportFile(fakeFile("cards.txt", "Hello / Olá")))
      .rejects.toThrow("arquivo JSON");
  });

  it("rejects empty files", async () => {
    await expect(readCompleteImportFile(fakeFile("cards.json", "   ")))
      .rejects.toThrow("está vazio");
  });

  it("rejects files above the configured limit", async () => {
    await expect(readCompleteImportFile(fakeFile(
      "cards.json",
      "{}",
      SMART_IMPORT_LIMITS.maxFileBytes + 1,
    ))).rejects.toThrow("excede");
  });
});
