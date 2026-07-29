import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sectionSource = readFileSync(
  new URL("./components/GlobalImportDestinationSection.tsx", import.meta.url),
  "utf8",
);
const screenSource = readFileSync(
  new URL("./SuperGlobalImportScreenV2.tsx", import.meta.url),
  "utf8",
);

describe("seleção antecipada de lista existente", () => {
  it("renderiza as listas da pasta como opções reais de destino", () => {
    expect(sectionSource).toContain('id="existing-import-list"');
    expect(sectionSource).toContain("selectedLists.map((list)");
    expect(sectionSource).toContain('<SelectItem key={list.id} value={list.id}>');
    expect(sectionSource).toContain("Adicionar os novos cards");
    expect(sectionSource).not.toContain("<ul className=");
  });

  it("limpa a lista quando a pasta muda e envia a escolha ao plano", () => {
    expect(screenSource).toContain("existingListId: selectedList?.id");
    expect(screenSource).toContain("existingListStrategy: selectedListStrategy");
    expect(screenSource).toContain("setSelectedListId(\"\")");
    expect(screenSource).toContain("setSelectedListStrategy(\"append\")");
  });
});
