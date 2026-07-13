import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  appendTeacherUrlsToSitemap,
  buildTeacherJsonLd,
  injectTeacherRedirects,
  renderTeacherHtml,
} from "./prerender-public-teachers.mjs";
import { publicTeacherPath } from "./public-directory-data.mjs";

const root = process.cwd();
const distDir = resolve(root, "dist");
const reportPath = resolve(distDir, "public-teacher-prerender-report.json");
const templatePath = resolve(distDir, "index.html");
const sitemapPath = resolve(distDir, "sitemap.xml");
const redirectsPath = resolve(distDir, "_redirects");

for (const path of [reportPath, templatePath, sitemapPath, redirectsPath]) {
  assert.ok(existsSync(path), `Arquivo obrigatório ausente: ${path}`);
}

const sample = {
  display_name: "Professora Ana & Silva",
  avatar_url: "https://example.com/ana.jpg",
  public_slug: "ana-silva",
  public_bio: "Aulas de inglês para iniciantes & conversação.",
  public_specialties: ["Inglês para iniciantes", "Conversação"],
  folder_count: 1,
  list_count: 2,
  card_count: 30,
  folders: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Inglês A1 & A2",
      description: "Vocabulário essencial.",
      list_count: 2,
      card_count: 30,
    },
  ],
};

const template = readFileSync(templatePath, "utf8");
const rendered = renderTeacherHtml(template, sample);
const samplePath = publicTeacherPath(sample.public_slug);
const sampleUrl = `https://www.apeeducation.org${samplePath}`;

assert.match(rendered, /data-prerendered="true"/);
assert.ok(rendered.includes("Professora Ana &amp; Silva"), "Nome escapado ausente no HTML.");
assert.ok(rendered.includes(`<link rel="canonical" href="${sampleUrl}"`), "Canonical dinâmica ausente.");
assert.ok(rendered.includes('"@type":"ProfilePage"'), "ProfilePage ausente no JSON-LD.");
assert.ok(rendered.includes('"@type":"Person"'), "Person ausente no JSON-LD.");
assert.ok(rendered.includes('"@type":"ItemList"'), "ItemList de materiais ausente no JSON-LD.");
assert.ok(rendered.includes("Inglês A1 &amp; A2"), "Material público não está visível no HTML.");
assert.ok(!rendered.includes("<script id=\"public-teacher-jsonld\">{\"@context\":"), "JSON-LD deve declarar o type application/ld+json.");

const graph = buildTeacherJsonLd(sample)["@graph"];
assert.equal(graph[0]["@type"], "ProfilePage");
assert.equal(graph[1]["@type"], "Person");
assert.deepEqual(graph[1].knowsAbout, sample.public_specialties);

const baseSitemap = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.apeeducation.org/portal</loc></url></urlset>\n';
const sitemapWithTeacher = appendTeacherUrlsToSitemap(baseSitemap, [sample], "2026-07-13");
assert.ok(sitemapWithTeacher.includes(`<loc>${sampleUrl}</loc>`));
assert.equal((sitemapWithTeacher.match(new RegExp(sampleUrl, "g")) ?? []).length, 1);
assert.equal(appendTeacherUrlsToSitemap(sitemapWithTeacher, [sample], "2026-07-13"), sitemapWithTeacher);

const baseRedirects = "/portal                     /portal/index.html              200\n/*                          /index.html                       200\n";
const redirectsWithTeacher = injectTeacherRedirects(baseRedirects, [sample]);
assert.ok(redirectsWithTeacher.includes(`${samplePath}/index.html`));
assert.ok(redirectsWithTeacher.indexOf(samplePath) < redirectsWithTeacher.indexOf("/*"));

const report = JSON.parse(readFileSync(reportPath, "utf8"));
assert.equal(typeof report.generatedAt, "string");
assert.equal(typeof report.runtimeSource, "string");
assert.equal(typeof report.teacherCount, "number");
assert.ok(Array.isArray(report.generatedPaths));
assert.equal(report.teacherCount, report.generatedPaths.length);

const deployedSitemap = readFileSync(sitemapPath, "utf8");
const deployedRedirects = readFileSync(redirectsPath, "utf8");
for (const generatedPath of report.generatedPaths) {
  const htmlPath = resolve(distDir, generatedPath.slice(1), "index.html");
  assert.ok(existsSync(htmlPath), `HTML dinâmico ausente: ${generatedPath}`);
  const html = readFileSync(htmlPath, "utf8");
  assert.ok(html.includes('data-public-teacher="'), `${generatedPath}: marcador de professor ausente.`);
  assert.ok(html.includes('"@type":"ProfilePage"'), `${generatedPath}: ProfilePage ausente.`);
  assert.ok(deployedSitemap.includes(`<loc>https://www.apeeducation.org${generatedPath}</loc>`), `${generatedPath}: sitemap ausente.`);
  assert.ok(deployedRedirects.includes(`${generatedPath}/index.html`), `${generatedPath}: redirect pré-renderizado ausente.`);
}

const migration = readFileSync(resolve(root, "supabase/migrations/20260713022000_public_teacher_discovery_prerender.sql"), "utf8");
assert.ok(migration.includes("list_public_teacher_discovery_entries"));
assert.ok(migration.includes("GRANT EXECUTE"));
assert.ok(migration.includes("LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))"));

console.log(`Pré-render público validado: ${report.teacherCount} perfis reais e contrato sintético completo.`);
