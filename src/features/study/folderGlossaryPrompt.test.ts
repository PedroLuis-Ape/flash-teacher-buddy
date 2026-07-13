import { describe, expect, it } from "vitest";
import { buildFolderGlossaryAiPrompt } from "./lib/folderGlossaryPrompt";

describe("folder glossary AI prompt", () => {
  it("describes the canonical JSON contract and the current folder sides", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Verbo To Be",
      labelA: "Inglês",
      labelB: "Português",
    });

    expect(prompt).toContain('"app-piteco-folder-glossary"');
    expect(prompt).toContain('"1.0"');
    expect(prompt).toContain("Verbo To Be");
    expect(prompt).toContain('Lado A: "Inglês"');
    expect(prompt).toContain('Lado B: "Português"');
    expect(prompt).toContain("JSON puro e válido");
    expect(prompt).toContain("não crie duas entradas iguais no mesmo lado");
    expect(prompt).toContain("entries");
  });

  it("requires exact exhaustive coverage instead of a useful-word sample", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Avançado",
      labelA: "English",
      labelB: "Português",
    });

    expect(prompt).toContain("cada palavra individual encontrada no material de origem precisa ter uma entrada própria");
    expect(prompt).toContain("Artigos, pronomes, auxiliares, preposições, conectores");
    expect(prompt).toContain("Uma expressão completa nunca substitui as entradas individuais");
    expect(prompt).toContain('"were" deve continuar "were"');
    expect(prompt).toContain('"enslaved" deve continuar "enslaved"');
    expect(prompt).toContain('"because", "of" e "because of" podem e devem coexistir');
    expect(prompt).toContain("Uma quantidade aproximada nunca autoriza cortar a cobertura");
    expect(prompt).toContain("todas as palavras únicas do material possuem entrada individual exata no mesmo lado");
  });

  it("uses safe labels when folder metadata is blank", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: " ",
      labelA: "",
      labelB: " ",
    });

    expect(prompt).toContain("Pasta sem nome");
    expect(prompt).toContain('Lado A: "Lado A"');
    expect(prompt).toContain('Lado B: "Lado B"');
  });
});
