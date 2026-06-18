import { describe, expect, it } from "vitest";
import { parseGlobalImportText } from "./parser";
import { validateGlobalImportPackage } from "./checks";
import { GLOBAL_IMPORT_SCHEMA, GLOBAL_IMPORT_VERSION } from "./schema";

function makePackage(counts: number[]) {
  const names = ["Pasta A", "Pasta B", "Pasta C"];
  return {
    schema: GLOBAL_IMPORT_SCHEMA,
    version: GLOBAL_IMPORT_VERSION,
    package: {
      name: "Pacote de teste",
      source_language: "en",
      target_language: "pt-BR",
      folders: counts.map((count, folderIndex) => ({
        name: names[folderIndex] ?? `Pasta ${folderIndex + 1}`,
        expected_cards: count,
        lists: [{
          name: `Lista ${folderIndex + 1}`,
          expected_cards: count,
          cards: Array.from({ length: count }, (_, cardIndex) => ({
            front: `Frase ${folderIndex + 1}-${cardIndex + 1}`,
            back: `Tradução ${folderIndex + 1}-${cardIndex + 1}`,
          })),
        }],
      })),
    },
  };
}

describe("Super Importador Global V1", () => {
  it("preserva três pastas com 10 cards cada sem misturar a hierarquia", () => {
    const result = validateGlobalImportPackage(makePackage([10, 10, 10]));
    expect(result.valid).toBe(true);
    expect(result.summary).toEqual({ folders: 3, lists: 3, cards: 30 });
    expect(result.package?.package.folders.map((folder) => folder.lists[0].cards.length))
      .toEqual([10, 10, 10]);
  });

  it("respeita quantidades diferentes entre pastas", () => {
    const result = validateGlobalImportPackage(makePackage([5, 17, 2]));
    expect(result.valid).toBe(true);
    expect(result.summary.cards).toBe(24);
    expect(result.package?.package.folders.map((folder) => folder.lists[0].cards.length))
      .toEqual([5, 17, 2]);
  });

  it("preserva várias listas dentro da mesma pasta", () => {
    const value = makePackage([3]);
    value.package.folders[0].expected_cards = 6;
    value.package.folders[0].lists.push({
      name: "Lista adicional",
      expected_cards: 3,
      cards: Array.from({ length: 3 }, (_, index) => ({
        front: `Extra ${index + 1}`,
        back: `Tradução extra ${index + 1}`,
      })),
    });
    const result = validateGlobalImportPackage(value);
    expect(result.valid).toBe(true);
    expect(result.summary).toEqual({ folders: 1, lists: 2, cards: 6 });
  });

  it("informa o caminho exato quando um card não tem verso", () => {
    const value = makePackage([1]) as any;
    delete value.package.folders[0].lists[0].cards[0].back;
    const result = validateGlobalImportPackage(value);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "package.folders[0].lists[0].cards[0].back"))
      .toBe(true);
  });

  it("bloqueia contagem declarada diferente da real", () => {
    const value = makePackage([2]);
    value.package.folders[0].lists[0].expected_cards = 10;
    const result = validateGlobalImportPackage(value);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "count.list")).toBe(true);
  });

  it("detecta cards duplicados sem alterar o pacote", () => {
    const value = makePackage([2]);
    value.package.folders[0].lists[0].cards[1] = {
      ...value.package.folders[0].lists[0].cards[0],
    };
    const result = validateGlobalImportPackage(value);
    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.code === "duplicate.card")).toBe(true);
    expect(result.summary.cards).toBe(2);
  });

  it("aceita uma única cerca Markdown envolvendo JSON válido", () => {
    const valid = JSON.stringify(makePackage([1]));
    const parsed = parseGlobalImportText("```json\n" + valid + "\n```");
    const validation = validateGlobalImportPackage(parsed.value);

    expect(validation.valid).toBe(true);
    expect(validation.summary).toEqual({ folders: 1, lists: 1, cards: 1 });
  });

  it("rejeita texto extra e vírgula final em vez de alterar o pacote", () => {
    const malformed = JSON.stringify(makePackage([1])).replace(/}$/, ",}");
    expect(() => parseGlobalImportText("Resposta da IA:\n" + malformed)).toThrow();
    expect(() => parseGlobalImportText(malformed)).toThrow(/vírgula final/i);
  });

  it("rejeita versão futura com caminho de erro na versão", () => {
    const value = { ...makePackage([1]), version: 2 };
    const result = validateGlobalImportPackage(value);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "version")).toBe(true);
  });
});
