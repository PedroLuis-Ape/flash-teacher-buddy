import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildMethodologyEvidenceJsonLd,
  renderMethodologyEvidenceHtml,
} from "./prerender-methodology-evidence.mjs";

const root = process.cwd();
const distDir = resolve(root, "dist");
const sourceTemplatePath = resolve(root, "index.html");
const reportPath = resolve(distDir, "methodology-evidence-prerender-report.json");
const pages = JSON.parse(readFileSync(resolve(root, "config/public-seo-methodology-evidence.json"), "utf8"));

for (const path of [sourceTemplatePath, reportPath]) {
  assert.ok(existsSync(path), `Arquivo obrigatório ausente: ${path}`);
}

const sourceTemplate = readFileSync(sourceTemplatePath, "utf8");
const sample = pages[0];
const sampleHtml = renderMethodologyEvidenceHtml(sourceTemplate, sample);
assert.ok(sampleHtml.includes('data-prerendered="true"'));
assert.ok(sampleHtml.includes('data-methodology-evidence="/pt-br/metodologia"'));
assert.ok(sampleHtml.includes(`<link rel="canonical" href="https://www.apeeducation.org${sample.path}"`));
assert.ok(sampleHtml.includes('hreflang="en"'));
assert.ok(sampleHtml.includes('id="evidence-boundary"'));
assert.ok(sampleHtml.includes('id="research-references"'));
assert.ok(sampleHtml.includes("https://doi.org/10.1111/j.1467-9280.2006.01693.x"));
assert.ok(sampleHtml.includes('type="application/ld+json"'));
assert.ok(sampleHtml.includes('"@type":"Article"'));
assert.ok(sampleHtml.includes('"@type":"ScholarlyArticle"'));
assert.ok(sampleHtml.includes('"dateModified":"2026-07-13"'));

const graph = buildMethodologyEvidenceJsonLd(sample)["@graph"];
const article = graph.find((node) => node["@type"] === "Article");
assert.ok(article, "Article ausente no JSON-LD.");
assert.equal(article.author["@id"], "https://www.apeeducation.org/#pedro-luis-de-oliveira-silva");
assert.equal(article.publisher["@id"], "https://www.apeeducation.org/#organization");
assert.equal(article.citation.length, sample.references.length);
assert.ok(article.citation.every((citation) => citation["@type"] === "ScholarlyArticle"));

const report = JSON.parse(readFileSync(reportPath, "utf8"));
assert.equal(report.pageCount, pages.length);
assert.deepEqual([...report.generatedPaths].sort(), pages.map((page) => page.path).sort());

for (const page of pages) {
  const htmlPath = resolve(distDir, page.path.slice(1), "index.html");
  assert.ok(existsSync(htmlPath), `${page.path}: HTML estático ausente`);
  const html = readFileSync(htmlPath, "utf8");
  assert.ok(html.includes(`data-methodology-evidence="${page.path}"`), `${page.path}: marcador estático ausente`);
  assert.ok(html.includes(`<title>${page.title.replaceAll("&", "&amp;")}</title>`), `${page.path}: título ausente`);
  assert.ok(html.includes(`<link rel="canonical" href="https://www.apeeducation.org${page.path}"`), `${page.path}: canonical ausente`);
  assert.ok(html.includes('"@type":"Article"'), `${page.path}: Article ausente`);
  assert.equal((html.match(/"@type":"ScholarlyArticle"/g) ?? []).length, page.references.length, `${page.path}: número de citações estruturadas inválido`);
  for (const reference of page.references) {
    assert.ok(html.includes(reference.url), `${page.path}: referência ${reference.doi} ausente`);
  }
}

console.log(`Pré-render de metodologia/evidências validado: ${pages.length} artigos bilíngues.`);
