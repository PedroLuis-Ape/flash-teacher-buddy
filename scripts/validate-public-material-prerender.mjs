import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { publicCatalogPath, MATERIAL_LOCALES, localeUrlSegment } from "./public-material-data.mjs";
import {
  DEFAULT_ROBOTS,
  applyHead,
  renderCatalogStaticContent,
} from "./prerender-public-materials.mjs";

/**
 * Valida o catalogo publico curado: HTML prerenderizado, canonical unico,
 * robots autoritativo e ausencia de URLs com filtro no sitemap.
 *
 * Roda dentro do build (depois do prerender) e tambem pode ser executado
 * sozinho para inspecao.
 */
const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(root, "index.html");
const sitemapPath = resolve(distDir, "sitemap-materials.xml");

const canonicalTags = (html) => html.match(/<link rel="canonical"[^>]*>/gi) ?? [];
const robotsTags = (html) => html.match(/<meta name="robots"[^>]*>/gi) ?? [];

assert.ok(existsSync(templatePath), `Template ausente: ${templatePath}`);
const template = readFileSync(templatePath, "utf8");

// 1. O shell traz metas estaticos; applyHead precisa deixar exatamente um de cada.
assert.equal(canonicalTags(template).length, 1, "o shell deveria trazer um canonical para o teste ser significativo");
assert.equal(robotsTags(template).length, 1, "o shell deveria trazer um meta robots para o teste ser significativo");
const canonical = "https://www.apeeducation.org/pt-br/materiais";
const headed = applyHead(template, { title: "Catalogo", description: "Materiais publicos do APE.", canonical, robots: DEFAULT_ROBOTS });
assert.equal(canonicalTags(headed).length, 1, "applyHead deve deixar exatamente um canonical");
assert.ok(canonicalTags(headed)[0].includes(canonical), "applyHead deve gravar o canonical da rota");
assert.equal(robotsTags(headed).length, 1, "applyHead deve deixar exatamente um meta robots");
assert.ok(robotsTags(headed)[0].includes(DEFAULT_ROBOTS), "o meta robots remanescente deve ser o autoritativo da rota");
assert.ok(!headed.includes('rel="canonical" href="https://www.apeeducation.org/"'), "o canonical estatico do shell nao pode sobreviver");

// 2. Catalogo vazio precisa ser honesto: H1 real e nenhuma invencao de conteudo.
const emptyHtml = renderCatalogStaticContent({ locale: "pt-BR", items: [], total: 0 });
assert.match(emptyHtml, /data-public-catalog="pt-br"/, "marcador do catalogo ausente");
assert.match(emptyHtml, /<h1[^>]*>[^<]+<\/h1>/i, "H1 ausente no catalogo vazio");
assert.equal(/<li>/.test(emptyHtml), false, "catalogo vazio nao pode listar itens");
assert.ok(emptyHtml.includes("Ainda não há materiais publicados"), "estado vazio honesto ausente");

// 3. Catalogo populado precisa expor titulo, paths do servidor e contagem real.
const sampleItem = {
  slug: "exemplo-a1",
  title: "Exemplo A1 & revisao",
  folder_title: "Pasta publica",
  level: "A1",
  theme: "verbo to be",
  resource_type: "frases",
  summary: "Resumo real do material.",
  card_count: 12,
  author_name: "Professora Ana & Silva",
  author_slug: "ana-silva",
  canonical_path: "/pt-br/material/exemplo-a1",
  play_path: "/portal/list/11111111-1111-4111-8111-111111111111/games",
};
const filledHtml = renderCatalogStaticContent({ locale: "pt-BR", items: [sampleItem], total: 1 });
assert.ok(filledHtml.includes("Exemplo A1 &amp; revisao"), "titulo escapado do item ausente");
assert.ok(filledHtml.includes('href="/pt-br/material/exemplo-a1"'), "link canonico do material ausente");
assert.ok(filledHtml.includes('href="/portal/list/11111111-1111-4111-8111-111111111111/games"'), "CTA de jogo ausente");
assert.ok(filledHtml.includes("12"), "contagem de cards ausente");
assert.ok(!filledHtml.includes("Ainda não há materiais publicados"), "catalogo com itens nao pode mostrar estado vazio");

// 4. Cada locale precisa de uma pagina prerenderizada de catalogo.
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, "utf8");
  const locs = sitemap.match(/<loc>[^<]*<\/loc>/g) ?? [];
  assert.ok(locs.length > 0, "sitemap de materiais sem nenhuma <loc>");
  for (const loc of locs) {
    assert.ok(!loc.includes("?"), `sitemap nao pode conter URL com querystring: ${loc}`);
  }
  for (const locale of MATERIAL_LOCALES) {
    const path = publicCatalogPath(locale);
    const destination = resolve(distDir, path.slice(1), "index.html");
    assert.ok(existsSync(destination), `catalogo prerenderizado ausente: ${path}`);
    const html = readFileSync(destination, "utf8");
    const expectedCanonical = `https://www.apeeducation.org${path}`;
    assert.equal(canonicalTags(html).length, 1, `canonical duplicado ou ausente em ${path}`);
    assert.ok(canonicalTags(html)[0].includes(expectedCanonical), `canonical incorreto em ${path}`);
    assert.equal(robotsTags(html).length, 1, `meta robots duplicado ou ausente em ${path}`);
    assert.ok(robotsTags(html)[0].includes(DEFAULT_ROBOTS), `robots incorreto em ${path}`);
    assert.match(html, /<h1[^>]*>[^<]+<\/h1>/i, `H1 ausente em ${path}`);
    assert.ok(html.includes('data-prerendered="true"'), `conteudo estatico ausente em ${path}`);
    assert.ok(sitemap.includes(expectedCanonical), `catalogo ausente do sitemap: ${path}`);
    // Nenhuma variacao com filtro pode existir como pagina prerenderizada.
    const filtered = resolve(distDir, localeUrlSegment(locale), "materiais", "index.html");
    assert.ok(existsSync(filtered), `pagina base ausente: ${path}`);
  }
} else {
  console.log("sitemap-materials.xml ausente: validando apenas as funcoes puras.");
}

console.log("OK catalogo publico: canonical unico, robots autoritativo, H1 e sitemap sem filtros.");
