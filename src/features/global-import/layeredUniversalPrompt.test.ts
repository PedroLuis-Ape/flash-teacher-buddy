import { describe, expect, it } from "vitest";
import { buildLayeredUniversalGlobalImportPrompt } from "./layeredUniversalPrompt";

describe("layered universal global import prompt", () => {
  it("uses the smart 2.0 contract and explains the layered shape", () => {
    const prompt = buildLayeredUniversalGlobalImportPrompt();

    expect(prompt).toContain('schema "app-piteco-super-import"');
    expect(prompt).toContain('version "2.0"');
    expect(prompt).toContain('"type": "layered"');
    expect(prompt).toContain('"group_title"');
    expect(prompt).toContain('"layers"');
  });

  it("keeps database identifiers inside the application", () => {
    const prompt = buildLayeredUniversalGlobalImportPrompt();

    expect(prompt).toContain("Nunca gere parent_card_id, layer_index, UUID, user_id, list_id");
    expect(prompt).toContain("A ordem do array layers é a ordem oficial das camadas");
  });

  it("distinguishes semantic layers from unrelated category items", () => {
    const prompt = buildLayeredUniversalGlobalImportPrompt();

    expect(prompt).toContain("get = conseguir, entender, chegar");
    expect(prompt).toContain("dog, cat e horse");
    expect(prompt).toContain("cards normais separados");
  });
});
