import { describe, expect, it } from "vitest";
import { buildSimpleFlashcardPrompt } from "./simplePrompt";

describe("buildSimpleFlashcardPrompt", () => {
  it("fills the current list and uses the shared JSON delivery contract", () => {
    const prompt = buildSimpleFlashcardPrompt({
      listName: "Compras",
      sideALabel: "English",
      sideBLabel: "Português",
    });

    expect(prompt).toContain('lista "Compras"');
    expect(prompt).toContain('Lado A: "English"');
    expect(prompt).toContain('Lado B: "Português"');
    expect(prompt).toContain('"front":"Hello"');
    expect(prompt).toContain("Não gere cards em camadas");
    expect(prompt).toContain("Entregue prioritariamente um arquivo .json para download.");
    expect(prompt).toContain("Caso não seja possível gerar um arquivo, devolva somente o JSON puro no chat");
  });
});
