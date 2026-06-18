import { expect, it } from "vitest";
import { parseGlobalImportCsv } from "../csvPackage";

const header = '"folder_name","list_name","front","back"';

it("rejects a repeated header between CSV parts", () => {
  expect(() => parseGlobalImportCsv(`${header}\n"P","L","A","B"\n${header}`)).toThrow(/cabeçalho repetido/i);
});

it("rejects HTML inside CSV fields", () => {
  expect(() => parseGlobalImportCsv(`${header}\n"P","L","<b>A</b>","B"`)).toThrow(/HTML não é permitido/i);
});

it("reports the line of oversized names", () => {
  const name = "x".repeat(161);
  expect(() => parseGlobalImportCsv(`${header}\n"${name}","L","A","B"`)).toThrow(/Linha 2/i);
});
