import { describe, expect, it } from "vitest";
import { parseGlobalImportCsv } from "../csvPackage";

const header = '"folder_name","list_name","front","back"';

function csv(...rows: string[]) {
  return [header, ...rows].join("\n");
}

describe("global import CSV", () => {
  it("groups three independent folders", () => {
    const result = parseGlobalImportCsv(csv(
      '"Expressões","Principal","By the way","A propósito"',
      '"Passado","Principal","I visited her","Eu a visitei"',
      '"Futuro","Principal","I will call","Eu vou ligar"',
    ));
    expect(result.packageValue.package.folders).toHaveLength(3);
    expect(result.rows).toBe(3);
  });

  it("groups several lists inside one folder", () => {
    const result = parseGlobalImportCsv(csv(
      '"Viagens","Aeroporto","Where is the gate?","Onde fica o portão?"',
      '"Viagens","Hotel","I have a reservation","Eu tenho uma reserva"',
      '"Viagens","Restaurante","The check, please","A conta, por favor"',
    ));
    expect(result.packageValue.package.folders).toHaveLength(1);
    expect(result.packageValue.package.folders[0].lists).toHaveLength(3);
  });

  it("keeps different quantities per list", () => {
    const result = parseGlobalImportCsv(csv(
      '"Pasta","A","A1","A2"',
      '"Pasta","B","B1","B2"',
      '"Pasta","B","B3","B4"',
    ));
    expect(result.packageValue.package.folders[0].lists.map((list) => list.expected_cards)).toEqual([1, 2]);
  });

  it("supports commas and escaped quotes inside quoted fields", () => {
    const result = parseGlobalImportCsv(csv(
      '"Pasta","Lista","He said, ""hello"".","Ele disse, ""olá""."',
    ));
    expect(result.packageValue.package.folders[0].lists[0].cards[0].front).toBe('He said, "hello".');
  });

  it("rejects a missing required column", () => {
    expect(() => parseGlobalImportCsv('"folder_name","front","back"\n"P","A","B"')).toThrow(/cabeçalho/i);
  });

  it("rejects duplicate flashcards", () => {
    expect(() => parseGlobalImportCsv(csv(
      '"Pasta","A","Same","Igual"',
      '"Pasta","B","Same","Igual"',
    ))).toThrow(/repetido/i);
  });

  it("accepts a CSV wrapped in a Markdown fence with a warning", () => {
    const result = parseGlobalImportCsv(`\`\`\`csv\n${csv('"Pasta","Principal","A","B"')}\n\`\`\``);
    expect(result.notes).toHaveLength(1);
  });
});
