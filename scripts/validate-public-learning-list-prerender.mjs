import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  appendPublicLearningListUrlsToSitemap,
  buildPublicLearningListJsonLd,
  injectPublicLearningListRedirects,
  renderPublicLearningListHtml,
} from "./prerender-public-learning-lists.mjs";
import { publicLearningListPath } from "./public-learning-list-data.mjs";

const root = process.cwd();
const distDir = resolve(root, "dist");
const reportPath = resolve(distDir, "public-learning-list-prerender-report.json");
const templatePath = resolve(root, "index.html");
const sitemapPath = resolve(distDir, "sitemap.xml");
const redirectsPath = resolve(distDir, "_redirects");
for (const path of [reportPath, templatePath, sitemapPath, redirectsPath]) assert.ok(existsSync(path), `Arquivo ausente: ${path}`);

const sample = {
  id: "41414141-4141-4141-8141-414141414141",
  folder_id: "42424242-4242-4242-8242-424242424242",
  title: "Verbos & rotina",
  description: "Prática de verbos para iniciantes.",
  study_type: "language",
  lang_a: "en",
  lang_b: "pt",
  labels_a: "Inglês",
  labels_b: "Português",
  tts_enabled: true,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:00.000Z",
  folder_title: "Inglês A1",
  author_display_name: "Professor Pedro",
  author_slug: "professor-pedro",
  author_avatar_url: null,
  card_count: 30,
  cards: [{ id: "43434343-4343-4343-8343-434343434343", term: "wake up", translation: "acordar", created_at: "2026-07-01T12:00:00.000Z" }],
};

const template = readFileSync(templatePath, "utf8");
const rendered = renderPublicLearningListHtml(template, sample);
const path = publicLearningListPath(sample.id);
const canonical = `https://www.apeeducation.org${path}`;
assert.ok(rendered.includes('data-public-learning-list="41414141-4141-4141-8141-414141414141"'));
assert.ok(rendered.includes("Verbos &amp; rotina"));
assert.ok(rendered.includes(`<link rel="canonical" href="${canonical}"`));
assert.ok(!rendered.includes(`<link rel="canonical" href="${canonical}/games"`));
assert.ok(rendered.includes('"@type":"LearningResource"'));
assert.ok(rendered.includes('"@type":"ItemList"'));
assert.ok(rendered.includes("wake up"));
assert.ok(rendered.includes("acordar"));
assert.ok(rendered.includes(`/portal/folder/${sample.folder_id}`));
assert.ok(rendered.includes("/portal/professor/professor-pedro"));

const graph = buildPublicLearningListJsonLd(sample)["@graph"];
const resource = graph.find((node) => node["@type"] === "LearningResource");
assert.equal(resource.url, canonical);
assert.equal(resource.isPartOf.url, `https://www.apeeducation.org/portal/folder/${sample.folder_id}`);
assert.equal(resource.author["@id"], "https://www.apeeducation.org/portal/professor/professor-pedro#person");

const baseSitemap = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
const sitemap = appendPublicLearningListUrlsToSitemap(baseSitemap, [sample], "2026-07-13T12:00:00.000Z");
assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
assert.equal((sitemap.match(new RegExp(canonical, "g")) ?? []).length, 1);
const baseRedirects = "/*                          /index.html                       200\n";
const redirects = injectPublicLearningListRedirects(baseRedirects, [sample]);
assert.ok(redirects.includes(`${path}/index.html`));
assert.ok(redirects.indexOf(path) < redirects.indexOf("/*"));

const report = JSON.parse(readFileSync(reportPath, "utf8"));
assert.equal(typeof report.listCount, "number");
assert.equal(typeof report.previewCardCount, "number");
assert.ok(Array.isArray(report.generatedPaths));
assert.equal(report.listCount, report.generatedPaths.length);

const deployedSitemap = readFileSync(sitemapPath, "utf8");
const deployedRedirects = readFileSync(redirectsPath, "utf8");
for (const generatedPath of report.generatedPaths) {
  const htmlPath = resolve(distDir, generatedPath.slice(1), "index.html");
  assert.ok(existsSync(htmlPath), `${generatedPath}: HTML ausente`);
  const html = readFileSync(htmlPath, "utf8");
  assert.ok(html.includes('data-public-learning-list="'), `${generatedPath}: marcador ausente`);
  assert.ok(html.includes('"@type":"LearningResource"'), `${generatedPath}: LearningResource ausente`);
  assert.ok(deployedSitemap.includes(`<loc>https://www.apeeducation.org${generatedPath}</loc>`), `${generatedPath}: sitemap ausente`);
  assert.ok(deployedRedirects.includes(`${generatedPath}/index.html`), `${generatedPath}: redirect ausente`);
}

const migration = readFileSync(resolve(root, "supabase/migrations/20260713152000_public_learning_list_pages.sql"), "utf8");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const edge = readFileSync(resolve(root, "netlify/edge-functions/public-list-status.js"), "utf8");
const netlify = readFileSync(resolve(root, "netlify.toml"), "utf8");
assert.ok(migration.includes("list_public_learning_list_entries"));
assert.ok(migration.includes("get_public_learning_list_card_preview"));
assert.ok(migration.includes("fc.parent_card_id IS NULL"));
assert.ok(migration.includes("learning_list"));
assert.ok(app.includes('path="/portal/list/:id" element={<PublicLearningListPage />}'));
assert.ok(edge.includes('entityType: "learning_list"'));
assert.ok(netlify.includes('path = "/portal/list/*"'));

console.log(`Listas públicas validadas: ${report.listCount} páginas reais e contrato sintético completo.`);
