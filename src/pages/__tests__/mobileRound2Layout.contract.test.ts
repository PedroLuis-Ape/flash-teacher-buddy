import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), "utf8");
}

describe("segunda rodada mobile — legibilidade e densidade", () => {
  it("os recentes da Home não viram duas colunas já em 360px", () => {
    const index = source("src/pages/Index.tsx");
    expect(index).not.toContain("min-[360px]:grid-cols-2");
    // Duas colunas só a partir de 480px; abaixo disso é uma coluna legível.
    expect(index.match(/min-\[480px\]:grid-cols-2/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(index).toContain('grid grid-cols-1 items-start');
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
});
