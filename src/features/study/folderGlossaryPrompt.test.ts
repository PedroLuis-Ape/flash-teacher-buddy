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
    expect(prompt).toContain("exatamente estes oito campos");
    expect(prompt).toContain("não existem campos de revisão semântica");
  });

  it("separates exact extraction from theme-only generation", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Viagens",
      labelA: "English",
      labelB: "Português",
    });

    expect(prompt).toContain("Modo de extração exata");
    expect(prompt).toContain("Modo de geração por tema");
    expect(prompt).toContain("o material concreto define a cobertura obrigatória");
    expect(prompt).toContain("não afirme que cobriu palavras de um material que não foi fornecido");
    expect(prompt).toContain("Uma quantidade aproximada nunca autoriza cortar a cobertura");
  });

  it("requires exact exhaustive coverage instead of a useful-word sample", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Avançado",
      labelA: "English",
      labelB: "Português",
    });

    expect(prompt).toContain("cada palavra individual distinta encontrada no lado solicitado precisa ter uma entrada própria");
    expect(prompt).toContain("Artigos, pronomes, determinantes, auxiliares, preposições, conectores");
    expect(prompt).toContain("Uma expressão completa nunca substitui as entradas individuais");
    expect(prompt).toContain('"were" continua "were"');
    expect(prompt).toContain('"enslaved" continua "enslaved"');
    expect(prompt).toContain('"because", "of" e "because of" podem e devem coexistir');
    expect(prompt).toContain("todas as palavras únicas do material possuem entrada individual exata no mesmo lado");
    expect(prompt).toContain("cada palavra de um chunk também possui sua própria entrada individual");
  });

  it("requires context-first semantic decisions in the initial glossary", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "História",
      labelA: "English",
      labelB: "Português",
    });

    expect(prompt).toContain("Leia o contexto antes de escolher a tradução");
    expect(prompt).toContain("não o primeiro significado de um dicionário");
    expect(prompt).toContain("todos os exemplos em que o termo aparece");
    expect(prompt).toContain("número, pessoa, tempo, aspecto, voz, grau, modalidade e registro");
    expect(prompt).toContain("verifique falsos cognatos");
    expect(prompt).toContain("não use automaticamente \"ser/estar\"");
    expect(prompt).toContain('"enslaved" deve refletir o particípio passivo e o plural');
    expect(prompt).toContain("Palavras funcionais exigem o mesmo rigor");
    expect(prompt).toContain("não use uma tradução incorreta apenas por parecer mais simples");
  });

  it("keeps alternatives, notes and polysemy disciplined", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Business",
      labelA: "English",
      labelB: "Português",
    });

    expect(prompt).toContain("Não use alternatives como depósito de significados aleatórios de dicionário");
    expect(prompt).toContain("note deve explicar claramente qual sentido foi escolhido como principal");
    expect(prompt).toContain("não esconda o conflito usando uma tradução genérica");
    expect(prompt).toContain("não crie entradas duplicadas no mesmo lado para contornar a deduplicação do importador");
    expect(prompt).toContain("term e translation idênticos indicam provável erro");
  });

  it("requires a complete silent validation before returning JSON", () => {
    const prompt = buildFolderGlossaryAiPrompt({
      folderTitle: "Avançado",
      labelA: "English",
      labelB: "Português",
    });

    expect(prompt).toContain("CHECKLIST INTERNO OBRIGATÓRIO");
    expect(prompt).toContain("todos os exemplos disponíveis de cada term foram considerados");
    expect(prompt).toContain("a tradução é natural no idioma de destino");
    expect(prompt).toContain("nomes próprios, siglas, empréstimos ou cognatos inalterados possuem justificativa");
    expect(prompt).toContain("a resposta contém exatamente um objeto JSON puro, completo e importável");
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
