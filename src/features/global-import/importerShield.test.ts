import { describe, expect, it } from "vitest";
import { decodeImportBytes } from "./importSourceDecoder";
import {
  canonicalizeSmartImportKeys,
  ImportKeyCollisionError,
} from "./keyCanonicalizer";
import { normalizeSmartImportCompatibility } from "./importCompatibility";
import { extractAndRepairJson, hasTruncatedJson } from "./resilientParser";
import { parseSmartJsonWithShield } from "@/features/smart-import/jsonShield";

function bufferOf(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("unified importer shield", () => {
  it("extracts explanatory JSON and repairs trailing commas without changing strings", () => {
    const parsed = extractAndRepairJson(
      'Resposta:\n```json\n{"text":"keep ,} here","items":[1,2,],}\n```\nFim.',
    );
    expect(parsed?.value).toEqual({ text: "keep ,} here", items: [1, 2] });
    expect(parsed?.extracted).toBe(true);
    expect(parsed?.repaired).toBe(true);
  });

  it("detects truncated JSON while ignoring braces inside strings", () => {
    expect(hasTruncatedJson('{"text":"{ is text","items":[1,2]')).toBe(true);
  });

  it("decodes UTF-16 LE and Windows-1252 uploads", () => {
    const utf16 = decodeImportBytes(bufferOf([0xff, 0xfe, 0x7b, 0x00, 0x7d, 0x00]));
    expect(utf16.encoding).toBe("utf-16le");
    expect(utf16.text).toBe("{}");

    const latin = decodeImportBytes(bufferOf([0x63, 0x61, 0x66, 0xe9]));
    expect(latin.encoding).toBe("windows-1252");
    expect(latin.text).toBe("café");
  });

  it("canonicalizes common Portuguese and camelCase aliases by path", () => {
    const result = canonicalizeSmartImportKeys({
      schema: "app-piteco-super-import",
      version: "2.0",
      pacote: {
        nome: "Pacote",
        pastas: [{
          titulo: "Pasta",
          listas: [{
            titulo: "Lista",
            frontLanguage: "en",
            backLanguage: "pt-BR",
            flashcards: [{ tipo: "normal", termo: "hello", tradução: "olá" }],
          }],
        }],
      },
    });

    const value = result.value as any;
    expect(value.package.name).toBe("Pacote");
    expect(value.package.folders[0].lists[0].cards[0]).toMatchObject({
      type: "normal",
      front: "hello",
      back: "olá",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects ambiguous alias collisions instead of guessing", () => {
    expect(() => canonicalizeSmartImportKeys({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "One",
        title: "Different",
        folders: [],
      },
    })).toThrow(ImportKeyCollisionError);
  });

  it("moves an old folder glossary into the first list before strict validation", () => {
    const compatible = normalizeSmartImportCompatibility({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "Pacote",
        folders: [{
          name: "Pasta",
          glossary: [{ term: "hello", translation: "olá" }],
          lists: [{
            name: "Lista",
            front_language: "en",
            back_language: "pt-BR",
            cards: [{ type: "normal", front: "Hello", back: "Olá" }],
          }],
        }],
      },
    });

    const parsed = parseSmartJsonWithShield(JSON.stringify(compatible.value));
    expect(parsed?.packageValue.package.folders[0].lists[0].glossary).toHaveLength(1);
  });
});
