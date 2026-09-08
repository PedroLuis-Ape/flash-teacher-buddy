import { describe, expect, it, vi } from "vitest";
import { readImportFile } from "./readImportFile";

describe("shared import file reader", () => {
  it.each(["", " \n\t", "\uFEFF"]) ("rejects empty content %j", async (text) => {
    await expect(readImportFile({ name: "data.txt", size: 3, text: async () => text }, 20)).rejects.toThrow("vazio");
  });
  it("preserves bytes represented by the existing File.text contract, including BOM and whitespace", async () => {
    const text = '\uFEFF  "olá, mundo";"hello"\r\n';
    await expect(readImportFile({ name: "data.csv", size: 40, text: async () => text }, 40)).resolves.toBe(text);
  });
  it("does not read oversized files", async () => {
    const text = vi.fn();
    await expect(readImportFile({ name: "data.json", size: 21, text }, 20)).rejects.toThrow("excede");
    expect(text).not.toHaveBeenCalled();
  });
  it("turns an unreadable file error into a safe actionable message", async () => {
    await expect(readImportFile({ name: "data.json", size: 1, text: async () => { throw new Error("private internal path"); } }, 20)).rejects.toThrow("Selecione-o novamente");
  });
  it("leaves format validation to the specialized parser", async () => {
    await expect(readImportFile({ name: "data.json", size: 1, text: async () => "{" }, 20)).resolves.toBe("{");
  });
});
