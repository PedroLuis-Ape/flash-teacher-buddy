import { describe, expect, it } from "vitest";
import { parseAnySmartImportSource } from "./parseAnySource";
import { parseSmartImportSource } from "./sourceParser";
import { buildSmartImportPrompt } from "./prompt";
import { summarizeSmartImport } from "./schema";

const context = {
  packageName: "Teste",
  folderName: "Pasta",
  listName: "Lista",
  frontLanguage: "en",
  backLanguage: "pt-BR",
};

describe("smart import source parser", () => {
  it("parses text with overlapping glossary and layered cards", () => {
    const result = parseSmartImportSource(`=== GLOSSÁRIO GLOBAL ===
because / porque
of / de
because of / por causa de
=== CARDS ===
It happened because of the rain. / Isso aconteceu por causa da chuva.
[CAMADAS]
look up
I looked up the word. / Eu pesquisei a palavra.
Things are looking up. / As coisas estão melhorando.`, context);

    const list = result.packageValue.package.folders[0].lists[0];
    expect(list.glossary.map((entry) => entry.term)).toEqual(["because", "of", "because of"]);
    expect(list.cards.some((card) => card.type === "layered")).toBe(true);
    expect(summarizeSmartImport(result.packageValue)).toMatchObject({
      cards: 3,
      layeredGroups: 1,
      glossaryEntries: 3,
    });
  });

  it("parses multiline quoted CSV and contextual hints", () => {
    const result = parseSmartImportSource(`record_type,folder_name,list_name,record_key,parent_key,front_language,back_language,side,front,back,hint,detailed_explanation,usage_notes,common_mistakes,note,active,group_title
card,Pasta,Lista,c1,,en,pt-BR,A,"It happened, because of rain.",Aconteceu por causa da chuva.,,,,"Linha um
Linha dois",,,
word_hint,Pasta,Lista,h1,c1,en,pt-BR,A,because of,por causa de,,,,,expressão,true,`, context);
    const list = result.packageValue.package.folders[0].lists[0];
    const card = list.cards[0];
    expect(card.type).toBe("normal");
    if (card.type !== "normal") throw new Error("card normal esperado");
    expect(card.common_mistakes).toContain("Linha dois");
    expect(card.word_hints?.[0].text).toBe("because of");
  });

  it("accepts a v2 JSON package", () => {
    const json = JSON.stringify({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "Pacote",
        folders: [{
          name: "Pasta",
          lists: [{
            name: "Lista",
            front_language: "en",
            back_language: "pt-BR",
            glossary: [],
            cards: [{ type: "normal", front: "house", back: "casa" }],
          }],
        }],
      },
    });
    const result = parseSmartImportSource(json);
    expect(result.format).toBe("json-v2");
    expect(result.packageValue.declared_totals).toBeUndefined();
  });

  it("normalizes an official v1 JSON package into the v2 core", () => {
    const json = JSON.stringify({
      schema: "app-piteco-super-import",
      version: "1.0",
      declared_totals: { folders: 1, lists: 1, cards: 1 },
      package: {
        name: "Pacote 1.0",
        folders: [{
          name: "Pasta",
          declared_totals: { lists: 1, cards: 1 },
          lists: [{
            name: "Lista",
            front_language: "en",
            back_language: "pt-BR",
            declared_card_count: 1,
            cards: [{ front: "house", back: "casa" }],
          }],
        }],
      },
    });

    const result = parseAnySmartImportSource(json);
    const list = result.packageValue.package.folders[0].lists[0];
    expect(result.notes[0]).toContain("1.0");
    expect(result.packageValue.version).toBe("2.0");
    expect(list.cards[0]).toMatchObject({ type: "normal", front: "house", back: "casa" });
  });
});

describe("smart prompt", () => {
  it("only includes explicitly enabled enriched resources", () => {
    const prompt = buildSmartImportPrompt({
      outputFormat: "json",
      includeGlobalGlossary: true,
      includeContextGlossary: true,
      includeDetailedExplanations: false,
      includeLayeredCards: false,
    });
    expect(prompt).toContain("Inclua glossário global");
    expect(prompt).toContain("Inclua word_hints");
    expect(prompt).toContain("Não crie detailed_explanation");
    expect(prompt).toContain("Não crie cards layered");
  });
});
