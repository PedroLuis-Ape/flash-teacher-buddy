import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regressão real (2026-09-13): o refactor de identidade removeu a camada derivada
 * `--ape-*` de space-layouts.css, mas dezenas de regras continuaram usando
 * var(--ape-surface/--ape-button/--ape-page/--ape-shadow). Variável indefinida em
 * `background:` invalida a declaração => fundo TRANSPARENTE => botões e cards
 * sumiam (ex.: "Sabia" invisível ao lado de "Não Sabia").
 *
 * Este contrato impede que qualquer `var(--ape-*)` do CSS fique sem definição.
 */
const readCss = () => {
  const files = ["src/index.css"];
  for (const name of readdirSync(resolve(process.cwd(), "src/styles"))) {
    if (name.endsWith(".css")) files.push(`src/styles/${name}`);
  }
  return files.map((file) => ({ file, css: readFileSync(resolve(process.cwd(), file), "utf8") }));
};

describe("tokens derivados --ape-*", () => {
  const sources = readCss();
  const used = new Set<string>();
  const defined = new Set<string>();
  for (const { css } of sources) {
    for (const m of css.matchAll(/var\(\s*(--ape-[a-z0-9-]+)/gi)) used.add(m[1]);
    for (const m of css.matchAll(/(--ape-[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
  }

  it("todo --ape-* usado no CSS está definido em algum lugar", () => {
    const missing = [...used].filter((token) => !defined.has(token)).sort();
    expect(missing).toEqual([]);
  });

  it("a camada derivada de superfície existe para todas as paletas", () => {
    const tokensCss = sources.find((s) => s.file.endsWith("space-ui-v1.css"))?.css ?? "";
    expect(tokensCss).toMatch(/html\[data-palette\]\s*\{/);
    for (const token of ["--ape-page", "--ape-surface", "--ape-soft", "--ape-button", "--ape-shadow", "--ape-nav"]) {
      expect(tokensCss).toContain(`${token}:`);
    }
  });

  it("a camada derivada acompanha os tokens canônicos em vez de fixar cor", () => {
    const tokensCss = sources.find((s) => s.file.endsWith("space-ui-v1.css"))?.css ?? "";
    const block = tokensCss.slice(tokensCss.indexOf("html[data-palette]{"));
    expect(block).toContain("--ape-surface:hsl(var(--card))");
    expect(block).toContain("--ape-button:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)))");
    expect(block).toContain("--ape-nav-text:hsl(var(--muted-foreground))");
  });
});

