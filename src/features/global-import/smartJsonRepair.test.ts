import { describe, expect, it } from "vitest";
import { repairSmartImportJsonText } from "./smartJsonRepair";

describe("repairSmartImportJsonText", () => {
  it("converts common AI list fields into multiline strings", () => {
    const input = JSON.stringify({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "Teste",
        folders: [{
          name: "Pasta",
          lists: [{
            name: "Lista",
            cards: [{
              type: "normal",
              front: "I can help.",
              back: "Eu posso ajudar.",
              usage_notes: ["Use can para habilidade.", "Também pode indicar possibilidade."],
              common_mistakes: ["Não use can to help."],
            }],
          }],
        }],
      },
    });

    const repaired = repairSmartImportJsonText(input);
    const parsed = JSON.parse(repaired.text);
    const card = parsed.package.folders[0].lists[0].cards[0];

    expect(repaired.changed).toBe(true);
    expect(card.usage_notes).toBe("Use can para habilidade.\nTambém pode indicar possibilidade.");
    expect(card.common_mistakes).toBe("Não use can to help.");
    expect(repaired.notes.join(" ")).toContain("2 campo(s)");
  });

  it("repairs fields inside layered cards", () => {
    const input = JSON.stringify({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: {
        name: "Teste",
        folders: [{
          name: "Pasta",
          lists: [{
            name: "Lista",
            cards: [{
              type: "layered",
              group_title: "can",
              layers: [{
                front: "Can I leave?",
                back: "Posso sair?",
                usage_notes: ["Pedido de permissão."],
              }, {
                front: "It can rain.",
                back: "Pode chover.",
                common_mistakes: ["Não confunda com passado."],
              }],
            }],
          }],
        }],
      },
    });

    const repaired = repairSmartImportJsonText(input);
    const layers = JSON.parse(repaired.text).package.folders[0].lists[0].cards[0].layers;
    expect(layers[0].usage_notes).toBe("Pedido de permissão.");
    expect(layers[1].common_mistakes).toBe("Não confunda com passado.");
  });

  it("does not alter unrelated or already valid JSON", () => {
    const input = JSON.stringify({
      schema: "app-piteco-super-import",
      version: "2.0",
      package: { name: "Teste", folders: [] },
    });
    const repaired = repairSmartImportJsonText(input);
    expect(repaired.changed).toBe(false);
    expect(repaired.text).toBe(input);
  });
});
