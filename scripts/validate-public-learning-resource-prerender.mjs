import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  appendLearningResourceUrlsToSitemap,
  buildLearningResourceJsonLd,
  injectLearningResourceRedirects,
  renderLearningResourceHtml,
} from "./prerender-public-learning-resources.mjs";
import { publicLearningResourcePath } from "./public-learning-resource-data.mjs";

const root = process.cwd();
const distDir = resolve(root, "dist");
const reportPath = resolve(distDir, "public-learning-resource-prerender-report.json");
const sourceTemplatePath = resolve(root, "index.html");
const sitemapPath = resolve(distDir, "sitemap.xml");
const redirectsPath = resolve(distDir, "_redirects");

for (const path of [reportPath, sourceTemplatePath, sitemapPath, redirectsPath]) {
  assert.ok(existsSync(path), `Arquivo obrigatório ausente: ${path}`);
}

const sample = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Inglês A1 & A2",
  description: "Vocabulário essencial para iniciantes & revisão.",
  study_type: "language",
  lang_a: "en",
  lang_b: "pt",
  labels_a: "Inglês",
  labels_b: "Português",
  tts_enabled: true,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:00.000Z",
  author_display_name: "Professora Ana & Silva",
  author_slug: "ana-silva",
  author_avatar_url: "https://example.com/ana.jpg",
  list_count: 1,
  card_count: 30,
  lists: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Verbos & rotina",
      description: "Prática diária.",
      order_index: 0,
      study_type: "language",
      lang_a: "en",
      lang_b: "pt",
      labels_a: "Inglês",
      labels_b: "Português",
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-07-13T12:00:00.000Z",
      card_count: 30,
    },
  ],
};

const sourceTemplate = readFileSync(sourceTemplatePath, "utf8");
const rendered = renderLearningResourceHtml(sourceTemplate, sample);
const samplePath = publicLearningResourcePath(sample.id);
const sampleUrl = `https://www.apeeducation.org${samplePath}`;

assert.match(rendered, /data-prerendered="true"/);
assert.ok(rendered.includes("Inglês A1 &amp; A2"), "Título escapado ausente no HTML.");
assert.ok(rendered.includes("Professora Ana &amp; Silva"), "Autoria visível ausente.");
assert.ok(rendered.includes(`<link rel="canonical" href="${sampleUrl}"`), "Canonical dinâmica ausente.");
assert.ok(rendered.includes('<script id="public-learning-resource-jsonld" type="application/ld+json">'), "Script JSON-LD tipado ausente.");
assert.ok(rendered.includes('"@type":"CollectionPage"'), "CollectionPage ausente.");
assert.ok(rendered.includes('"@type":"LearningResource"'), "LearningResource ausente.");
assert.ok(rendered.includes('"@type":"ItemList"'), "ItemList ausente.");
assert.ok(rendered.includes("Verbos &amp; rotina"), "Lista pública não está visível no HTML.");
assert.ok(rendered.includes('datetime="2026-07-13T12:00:00.000Z"'), "Data de atualização ausente.");

const graph = buildLearningResourceJsonLd(sample)["@graph"];
assert.equal(graph[0]["@type"], "CollectionPage");
assert.equal(graph[1]["@type"], "LearningResource");
assert.deepEqual(graph[1].inLanguage, ["en", "pt"]);
assert.equal(graph[2]["@type"], "Person");
assert.ok(graph.some((node) => node["@type"] === "ItemList"));

const baseSitemap = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.apeeducation.org/portal</loc></url></urlset>\n';
const sitemapWithResource = appendLearningResourceUrlsToSitemap(baseSitemap, [sample], "2026-07-13");
assert.ok(sitemapWithResource.includes(`<loc>${sampleUrl}</loc>`));
assert.ok(sitemapWithResource.includes("<lastmod>2026-07-13</lastmod>"));
assert.equal((sitemapWithResource.match(new RegExp(sampleUrl, "g")) ?? []).length, 1);
assert.equal(appendLearningResourceUrlsToSitemap(sitemapWithResource, [sample], "2026-07-13"), sitemapWithResource);

const baseRedirects = "/portal                     /portal/index.html              200\n/*                          /index.html                       200\n";
const redirectsWithResource = injectLearningResourceRedirects(baseRedirects, [sample]);
assert.ok(redirectsWithResource.includes(`${samplePath}/index.html`));
assert.ok(redirectsWithResource.indexOf(samplePath) < redirectsWithResource.indexOf("/*"));

const report = JSON.parse(readFileSync(reportPath, "utf8"));
assert.equal(typeof report.generatedAt, "string");
assert.equal(typeof report.runtimeSource, "string");
assert.equal(typeof report.discoveryMode, "string");
assert.equal(typeof report.resourceCount, "number");
assert.ok(Array.isArray(report.generatedPaths));
assert.equal(report.resourceCount, report.generatedPaths.length);

const deployedSitemap = readFileSync(sitemapPath, "utf8");
const deployedRedirects = readFileSync(redirectsPath, "utf8");
for (const generatedPath of report.generatedPaths) {
  const htmlPath = resolve(distDir, generatedPath.slice(1), "index.html");
  assert.ok(existsSync(htmlPath), `HTML dinâmico ausente: ${generatedPath}`);
  const html = readFileSync(htmlPath, "utf8");
  assert.ok(html.includes('data-public-learning-resource="'), `${generatedPath}: marcador de recurso ausente.`);
  assert.ok(html.includes('"@type":"LearningResource"'), `${generatedPath}: LearningResource ausente.`);
  assert.ok(deployedSitemap.includes(`<loc>https://www.apeeducation.org${generatedPath}</loc>`), `${generatedPath}: sitemap ausente.`);
  assert.ok(deployedRedirects.includes(`${generatedPath}/index.html`), `${generatedPath}: redirect pré-renderizado ausente.`);
}

const discoveryMigration = readFileSync(
  resolve(root, "supabase/migrations/20260713134000_public_learning_resource_discovery.sql"),
  "utf8",
);
const compatibilityMigration = readFileSync(
  resolve(root, "supabase/migrations/20260713134600_public_learning_resource_compatibility.sql"),
  "utf8",
);
const canonicalCountsMigration = readFileSync(
  resolve(root, "supabase/migrations/20260713134700_public_learning_resource_canonical_counts.sql"),
  "utf8",
);

assert.ok(discoveryMigration.includes("list_public_learning_resource_entries"));
assert.ok(discoveryMigration.includes("get_public_learning_resource_lists"));
assert.ok(discoveryMigration.includes("l.visibility = 'class'"));
assert.ok(discoveryMigration.includes("l.class_id IS NULL"));
assert.ok(discoveryMigration.includes("REVOKE ALL ON FUNCTION"));
assert.ok(discoveryMigration.includes("GRANT EXECUTE"));

assert.ok(compatibilityMigration.includes("t.public = true"));
assert.ok(compatibilityMigration.includes("t.ativo = true"));
assert.ok(compatibilityMigration.includes("fc.parent_card_id IS NULL"));
assert.ok(compatibilityMigration.includes("a.fonte_tipo::text = 'lista'"));
assert.ok(compatibilityMigration.includes("a.fonte_tipo::text = 'pasta'"));

assert.equal((canonicalCountsMigration.match(/fc\.parent_card_id IS NULL/g) ?? []).length, 3);
assert.ok(canonicalCountsMigration.includes("list_public_learning_resource_entries"));
assert.ok(canonicalCountsMigration.includes("get_public_learning_resource_lists"));

console.log(`Materiais públicos validados: ${report.resourceCount} recursos reais e contrato sintético completo.`);
