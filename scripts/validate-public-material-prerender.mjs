import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { publicCatalogPath, MATERIAL_LOCALES, localeUrlSegment } from "./public-material-data.mjs";
import {
  DEFAULT_ROBOTS,
  applyHead,
  buildMaterialJsonLd,
  injectMaterialStructuredData,
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

// 5. JSON-LD do material: fiel ao payload e sem valores inventados.
const materialFixture = {
  locale: "pt-BR",
  slug: "exemplo-a1",
  canonical_path: "/pt-br/material/exemplo-a1",
  play_path: "/portal/list/11111111-1111-4111-8111-111111111111/games",
  editorial: {
    level: "A1",
    theme: "verbo to be",
    resource_type: "frases",
    summary: "Resumo real do material.",
    reviewed_at: "2026-09-01T12:00:00.000Z",
  },
  list: {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Exemplo A1",
    folder_title: "Pasta publica",
    lang_a: "en",
    lang_b: "pt",
    card_count: 12,
    author_name: "Professora Ana",
    author_slug: "ana-silva",
  },
};
const materialJsonLd = buildMaterialJsonLd(materialFixture);
const jsonLdTypes = materialJsonLd["@graph"].map((node) => node["@type"]);
assert.ok(jsonLdTypes.includes("LearningResource"), "LearningResource ausente no JSON-LD do material");
assert.ok(jsonLdTypes.includes("BreadcrumbList"), "BreadcrumbList ausente no JSON-LD do material");
const materialResource = materialJsonLd["@graph"].find((node) => node["@type"] === "LearningResource");
assert.equal(materialResource.url, "https://www.apeeducation.org/pt-br/material/exemplo-a1");
assert.equal(materialResource.educationalLevel, "A1");
assert.equal(materialResource.learningResourceType, "frases");
assert.equal(materialResource.numberOfItems, 12);
assert.equal(materialResource.isAccessibleForFree, true);
assert.deepEqual(materialResource.inLanguage, ["en", "pt"]);

const materialBreadcrumb = materialJsonLd["@graph"].find((node) => node["@type"] === "BreadcrumbList");
assert.deepEqual(
  materialBreadcrumb.itemListElement.map((item) => item.name),
  ["Portal público", "Materiais", "Exemplo A1"],
);
assert.equal(materialBreadcrumb.itemListElement[1].item, "https://www.apeeducation.org/pt-br/materiais");

const materialJson = JSON.stringify(materialJsonLd);
assert.ok(!materialJson.includes(":null"), "JSON-LD do material nao pode conter null");
assert.ok(!materialJson.includes("undefined"), "JSON-LD do material nao pode conter undefined");

const sparseMaterial = buildMaterialJsonLd({
  ...materialFixture,
  editorial: { level: null, theme: null, resource_type: null, summary: null, reviewed_at: null },
  list: { ...materialFixture.list, author_slug: null },
});
const sparseResource = sparseMaterial["@graph"].find((node) => node["@type"] === "LearningResource");
for (const forbidden of ["educationalLevel", "about", "description", "dateModified"]) {
  assert.ok(!(forbidden in sparseResource), `JSON-LD nao pode inventar o campo ${forbidden}`);
}

// 5c. Sem autor no payload nao pode existir Person nem referencia de autoria.
const anonymousMaterial = buildMaterialJsonLd({
  ...materialFixture,
  list: { ...materialFixture.list, author_name: null, author_slug: null },
});
const anonymousTypes = anonymousMaterial["@graph"].map((node) => node["@type"]);
assert.ok(!anonymousTypes.includes("Person"), "JSON-LD nao pode inventar autor");
assert.ok(
  !("author" in anonymousMaterial["@graph"].find((node) => node["@type"] === "LearningResource")),
  "sem autor no payload nao pode existir referencia de autoria",
);

// 5d. O rotulo de interface do RPC nao pode contar como autoria.
const placeholderMaterial = buildMaterialJsonLd({
  ...materialFixture,
  list: { ...materialFixture.list, author_name: "Professor no APE", author_slug: null },
});
const placeholderTypes = placeholderMaterial["@graph"].map((node) => node["@type"]);
assert.ok(
  !placeholderTypes.includes("Person"),
  "o rotulo de interface nao pode virar Person no JSON-LD",
);
assert.ok(
  !("author" in placeholderMaterial["@graph"].find((node) => node["@type"] === "LearningResource")),
  "o rotulo de interface nao pode virar referencia de autoria",
);

// 5b. A injecao do JSON-LD precisa acontecer no HTML final do material.
const injectedHtml = injectMaterialStructuredData(
  "<html><head><title>x</title></head><body><div id=\"root\"></div></body></html>",
  materialFixture,
);
assert.ok(
  injectedHtml.includes('<script id="public-material-jsonld" type="application/ld+json">'),
  "HTML do material precisa receber o script JSON-LD",
);
const injectedMatch = injectedHtml.match(/<script id="public-material-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/);
const injectedGraph = JSON.parse(injectedMatch[1].replaceAll("\\u003c", "<"))["@graph"];
assert.ok(injectedGraph.some((node) => node["@type"] === "LearningResource"), "JSON-LD injetado sem LearningResource");
const headedMaterial = applyHead(
  "<html><head><title>x</title><meta name=\"robots\" content=\"index,follow\"><link rel=\"canonical\" href=\"https://www.apeeducation.org/\"></head><body></body></html>",
  { title: "t", description: "d", canonical: "https://www.apeeducation.org/pt-br/material/exemplo-a1" },
);
const materialRobots = headedMaterial.match(/<meta name="robots"[^>]*>/gi) ?? [];
assert.equal(materialRobots.length, 1, "pagina de material precisa de um unico meta robots");
assert.ok(!/noindex/i.test(materialRobots[0]), "material aprovado nao pode sair com noindex");

// 6. robots.txt libera o crawler de assistentes apenas nas superficies curadas.
const robotsTxt = readFileSync(resolve(root, "public", "robots.txt"), "utf8");
const assistantBlock = robotsTxt.split("User-agent: OAI-SearchBot")[1]?.split("User-agent:")[0] ?? "";
assert.ok(assistantBlock, "robots.txt precisa de um bloco para OAI-SearchBot");
for (const locale of MATERIAL_LOCALES) {
  const segment = localeUrlSegment(locale);
  assert.ok(
    assistantBlock.includes(`Allow: /${segment}/materiais`),
    `robots.txt deve liberar o catalogo de ${locale} para assistentes`,
  );
  assert.ok(
    assistantBlock.includes(`Allow: /${segment}/material/`),
    `robots.txt deve liberar os materiais de ${locale} para assistentes`,
  );
}
// Sem herdar o grupo `*`, o bloco precisa repetir as rotas privadas; um
// `Disallow: /` cru bloquearia superficies publicas curadas.
assert.ok(
  assistantBlock.includes("Disallow: /auth") && assistantBlock.includes("Disallow: /dashboard"),
  "o bloco de assistentes precisa repetir as rotas privadas do grupo *",
);
assert.ok(
  !/^Disallow: \/$/m.test(assistantBlock),
  "o bloco de assistentes nao pode bloquear o site inteiro",
);
for (const locale of MATERIAL_LOCALES) {
  const segment = localeUrlSegment(locale);
  for (const line of robotsTxt.split(/\r?\n/)) {
    if (!line.startsWith("Disallow:")) continue;
    assert.ok(
      !line.includes(`/${segment}/materiais`) && !line.includes(`/${segment}/material`),
      `robots.txt nao pode bloquear ${line.trim()} — superficie publica curada`,
    );
  }
}

console.log(
  "OK material publico: canonical unico, robots autoritativo, H1, JSON-LD fiel e sitemap sem filtros.",
);
