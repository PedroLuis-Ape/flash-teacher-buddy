import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const legacyPages = [
  ...JSON.parse(readFileSync(resolve(root, "config/public-seo-pages-international.json"), "utf8")),
  ...JSON.parse(readFileSync(resolve(root, "config/public-seo-official-sources.json"), "utf8")),
  ...JSON.parse(readFileSync(resolve(root, "config/public-seo-methodology-evidence.json"), "utf8")),
];
const localizedSource = JSON.parse(readFileSync(resolve(root, "config/editorial/international-locales.json"), "utf8"));
const baseRoutes = {
  home: { "pt-BR": "/pt-br", en: "/en" },
  features: { "pt-BR": "/pt-br/recursos", en: "/en/features" },
  flashcards: { "pt-BR": "/pt-br/flashcards", en: "/en/flashcards" },
  teachers: { "pt-BR": "/pt-br/para-professores", en: "/en/for-teachers" },
  about: { "pt-BR": "/pt-br/sobre", en: "/en/about" },
  official: { "pt-BR": "/pt-br/fonte-oficial", en: "/en/official-source" },
  methodology: { "pt-BR": "/pt-br/metodologia", en: "/en/methodology" },
  evidence: { "pt-BR": "/pt-br/evidencias", en: "/en/evidence" },
};
const localizedPages = Object.entries(localizedSource.locales).flatMap(([locale, localeSource]) => Object.entries(localeSource.pages).map(([key, page]) => {
  const routes = { ...baseRoutes[key], [locale]: localeSource.paths[key] };
  return { path: localeSource.paths[key], language: locale, h1: page.h1, alternates: [...Object.entries(routes).map(([hrefLang, href]) => ({ hrefLang, href })), { hrefLang: "x-default", href: "/" }] };
}));
const familyRoutes = Object.fromEntries(Object.entries(baseRoutes).map(([key, routes]) => [key, {
  ...routes,
  ...Object.fromEntries(Object.entries(localizedSource.locales).map(([locale, source]) => [locale, source.paths[key]])),
}]));
const routeFamily = new Map(Object.entries(familyRoutes).flatMap(([key, routes]) => Object.values(routes).map((path) => [path, key])));
const withFamilyAlternates = (page) => {
  const family = routeFamily.get(page.path);
  return family ? { ...page, alternates: [...Object.entries(familyRoutes[family]).map(([hrefLang, href]) => ({ hrefLang, href })), { hrefLang: "x-default", href: "/" }] } : page;
};
const pages = [...legacyPages.map(withFamilyAlternates), ...localizedPages.map(withFamilyAlternates)];
const errors = [];

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

for (const page of pages) {
  const path = resolve(root, process.env.PITECO_DIST_DIR ?? "dist", page.path.slice(1), "index.html");
  if (!existsSync(path)) {
    errors.push(`Arquivo ausente: ${page.path}`);
    continue;
  }

  const html = readFileSync(path, "utf8");
  const canonical = `https://www.apeeducation.org${page.path}`;
  if (!html.includes(`data-prerendered="true"`)) errors.push(`${page.path}: conteúdo estático ausente`);
  if (!html.includes(`<html lang="${page.language}"`)) errors.push(`${page.path}: html lang incorreto`);
  if (!html.includes(`<link rel="canonical" href="${canonical}"`)) errors.push(`${page.path}: canonical incorreta`);
  if (!html.includes(page.h1)) errors.push(`${page.path}: H1 ausente`);
  if (!html.includes(`"inLanguage":"${page.language}"`)) errors.push(`${page.path}: JSON-LD sem idioma correto`);

  for (const alternate of page.alternates) {
    const href = `https://www.apeeducation.org${alternate.href}`;
    if (!html.includes(`hreflang="${alternate.hrefLang}" href="${href}"`)) {
      errors.push(`${page.path}: alternate ${alternate.hrefLang} ausente`);
    }
  }

  if (page.officialSource) {
    if (!html.includes(`"@type":["SoftwareApplication","EducationalApplication"]`)) {
      errors.push(`${page.path}: entidade SoftwareApplication ausente`);
    }
    if (!html.includes(`"@type":"Person"`)) errors.push(`${page.path}: entidade Person ausente`);
    if (!html.includes(`"@type":"FAQPage"`)) errors.push(`${page.path}: FAQPage ausente`);
    if (!html.includes(escapeHtml(page.citation.text))) errors.push(`${page.path}: descrição de citação ausente no HTML`);
    if (!html.includes(`datetime="${page.dateModified}"`)) errors.push(`${page.path}: data editorial ausente`);
  }
}

if (errors.length) {
  console.error("Validação internacional falhou:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Validação internacional aprovada para ${pages.length} páginas.`);
