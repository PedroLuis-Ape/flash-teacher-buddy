import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), "utf8");
}

describe("segunda rodada mobile — legibilidade e densidade", () => {
  it("os recentes da Home só ganham duas colunas a partir de 640px (sm)", () => {
    const index = source("src/pages/Index.tsx");
    // Contrato novo: mobile = 1 coluna; 2 colunas só em >= 640px.
    expect(index.match(/sm:grid-cols-2/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(index).toContain("grid grid-cols-1 items-start");
  });

  it("a métrica “Listas” tem símbolo estável (não herda ícone invisível)", () => {
    const index = source("src/pages/Index.tsx");
    expect(index).toContain("📋");
    expect(index).not.toContain("<BookOpen");
    // O símbolo vive dentro do mesmo icon-tile das outras métricas.
    expect(index).toMatch(/icon-tile[^>]*>📋/);
  });

  it("o card de pasta prioriza o nome: ícone menor no mobile e wrap de 2 linhas", () => {
    const card = source("src/components/ape/ApeCardFolder.tsx");
    // Ícone compacto por padrão e maior só a partir de md.
    expect(card).toMatch(/w-9 h-9[^"]*md:w-12 md:h-12/);
    expect(card).toMatch(/text-lg[^"]*md:text-2xl/);
    // Menos respiro interno no mobile para sobrar largura ao título.
    expect(card).toContain("gap-2 px-2.5 py-2.5 md:gap-3 md:px-4 md:py-3");
    // Título sempre legível parado.
    expect(card).toContain('mobileBehavior="wrap"');
    expect(card).toContain("mobileLines={2}");
  });

  it("as listas dentro da pasta também usam título parado em duas linhas", () => {
    const folder = source("src/pages/Folder.tsx");
    expect(folder).toContain('mobileBehavior="wrap"');
    expect(folder).toContain("mobileLines={2}");
  });

  it("cards de lista e de pasta não voltam a animar sozinhos no mobile", () => {
    const list = source("src/components/ape/ApeCardList.tsx");
    expect(list).toContain('mobileBehavior="wrap"');
    expect(list).not.toContain('mobileBehavior="marquee"');
  });

  it("o header in-game do Study tem duas faixas no mobile e volta a uma linha no desktop", () => {
    const study = source("src/pages/Study.tsx");
    // Faixa 1 (Sair) + faixa 2 (ações) no mobile.
    expect(study).toContain("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between");
    // Cluster de ações ocupa a largura e quebra com respiro em vez de espremer.
    expect(study).toContain("flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-4");
    // Comportamento preservado: o Sair continua abrindo o diálogo de saída.
    expect(study).toContain("setShowExitDialog(true)");
  });

  it("a grade de pastas da biblioteca não empurra o título para uma coluna estreita", () => {
    const responsive = source("src/styles/library-responsive.css");
    // O CSS não decide mais quantidade de colunas (isso é do React/Tailwind);
    // sobra largura real para o título, sem reserva artificial exagerada.
    expect(responsive).not.toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(responsive).toContain("padding-inline: .75rem 3rem");
  });

  it("os containers ajustados não introduzem rolagem horizontal intencional", () => {
    for (const file of [
      "src/pages/Index.tsx",
      "src/pages/Study.tsx",
      "src/components/ape/ApeCardFolder.tsx",
      "src/components/ape/ApeCardList.tsx",
    ]) {
      const text = source(file);
      expect(text, file).not.toContain("overflow-x-scroll");
      expect(text, file).not.toContain("w-screen");
    }
  });

  it("cards de conteúdo usam 1 coluna no mobile e 2 só a partir de 640px", () => {
    const folders = source("src/features/library/FoldersOptimized.tsx");
    expect(folders).not.toContain("min-[360px]:grid-cols-2");
    expect(folders).toContain("grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2");

    const index = source("src/pages/Index.tsx");
    for (const legacy of ["min-[360px]:grid-cols-2", "min-[390px]:grid-cols-2", "min-[430px]:grid-cols-2", "min-[480px]:grid-cols-2"]) {
      expect(index, legacy).not.toContain(legacy);
    }

    const folder = source("src/pages/Folder.tsx");
    expect(folder).not.toContain("min-[420px]:grid-cols-2");
    expect(folder).toMatch(/grid grid-cols-1 gap-3 sm:grid-cols-2/);
  });

  it("o CSS da biblioteca não força quantidade de colunas (nem no mobile, nem com !important)", () => {
    const responsive = source("src/styles/library-responsive.css");
    expect(responsive).not.toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important");
    expect(responsive).not.toContain("max-width: 359px");
    expect(responsive).toContain("Quantidade de colunas é decisão do React/Tailwind");
    // Menu de ações do card de pasta mantém 44px de área tocável no mobile.
    expect(responsive).toContain("min-width: 2.75rem");
  });

  it(".ape-card-title não impõe truncate global (cada consumidor decide)", () => {
    const css = source("src/index.css");
    expect(css).toMatch(/\.ape-card-title \{\s*@apply font-semibold text-base leading-tight;/);
    expect(css).not.toMatch(/\.ape-card-title \{\s*@apply font-semibold text-base truncate leading-tight;/);
  });

  it("o topo in-game mobile usa 1 linha curta com caixa de ferramentas", () => {
    const study = source("src/pages/Study.tsx");
    expect(study).toContain("sm:hidden");
    expect(study).toMatch(/Ferramentas da sessão/);
    expect(study).toContain("STUDY_MODE_LABELS");
    expect(study).toContain("<SheetContent side=\"bottom\"");
    // A barra antiga (Reforço/Configurações/Comandos) sai do topo fixo no mobile.
    expect(study).toContain("mb-3 hidden space-y-2 sm:block");
  });
});
