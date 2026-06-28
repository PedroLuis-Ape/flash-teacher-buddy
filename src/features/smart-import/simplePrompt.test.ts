import { describe, expect, it } from "vitest";
import { buildSimpleFlashcardPrompt } from "./simplePrompt";

describe("buildSimpleFlashcardPrompt", () => {
  it("fills the current list and side labels", () => {
    const prompt = buildSimpleFlashcardPrompt({
      listName: "Compras",
      sideALabel: "English",
      sideBLabel: "Português",
    });

    expect(prompt).toContain('lista "Compras"');
    expect(prompt).toContain('Lado A: "English"');
    expect(prompt).toContain('Lado B: "Português"');
    expect(prompt).toContain("Hello / Olá");
    expect(prompt).toContain("Não gere glossário.");
    expect(prompt).toContain("Não gere JSON.");
  });
});
