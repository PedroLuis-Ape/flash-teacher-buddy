import { describe, expect, it } from "vitest";
import { decodeImportBytes } from "./importSourceDecoder";
import { canonicalizeSmartImportKeys, ImportKeyCollisionError } from "./keyCanonicalizer";
import { normalizeSmartImportCompatibility } from "./importCompatibility";
import { extractAndRepairJson, hasTruncatedJson } from "./resilientParser";
import { parseSmartJsonWithShield } from "@/features/smart-import/jsonShield";

const bufferOf = (bytes: number[]) => new Uint8Array(bytes).buffer;

describe("unified importer shield", () => {
  it("extracts and repairs JSON without touching string content", () => {
    const parsed = extractAndRepairJson('Resposta:\n```json\n{"text":"keep ,} here","items":[1,2,],}\n```');
    expect(parsed?.value).toEqual({ text: "keep ,} here", items: [1, 2] });
    expect(parsed?.extracted).toBe(true);
    expect(parsed?.repaired).toBe(true);
    expect(hasTruncatedJson('{"items":[1,2]')).toBe(true);
  });

  it("decodes UTF-16 and Windows-1252", () => {
    expect(decodeImportBytes(bufferOf([0xff, 0xfe, 0x7b, 0, 0x7d, 0]))).toMatchObject({ encoding: "utf-16le", text: "{}" });
    expect(decodeImportBytes(bufferOf([0x63, 0x61, 0x66, 0xe9]))).toMatchObject({ encoding: "windows-1252", text: "café" });
  });

  it("canonicalizes supported aliases and refuses collisions", () => {
    const result = canonicalizeSmartImportKeys({
      schema: "app-piteco-super-import",
      version: "2.0",
      pacote: { nome: "Pacote", pastas: [{ titulo: "Pasta", listas: [{ titulo: "Lista", frontLanguage: "en", backLanguage: "pt-BR", flashcards: [{ tipo: "normal", word: "hello", definition: "olá" }] }] }] },
    });
    expect((result.value as any).package.folders[0].lists[0].cards[0]).toMatchObject({ type: "normal", front: "hello", back: "olá" });
    expect(() => canonicalizeSmartImportKeys({ package: { name: "One", title: "Different" } })).toThrow(ImportKeyCollisionError);
  });

  it("moves old folder glossaries into the folder pipeline", () => {
    const compatible = normalizeSmartImportCompatibility({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: { name: "Pacote", folders: [{ name: "Pasta", glossary: [{ term: "hello", translation: "olá" }], lists: [{ name: "Lista", front_language: "en", back_language: "pt-BR", cards: [{ type: "normal", front: "Hello", back: "Olá" }] }] }] },
    });
    expect(parseSmartJsonWithShield(JSON.stringify(compatible.value))?.packageValue.package.folders[0].lists[0].glossary).toHaveLength(1);
  });
});
