import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pages = JSON.parse(readFileSync(resolve(root, "config/public-seo-pages-international.json"), "utf8"));
const errors = [];

for (const page of pages) {
  const path = resolve(root, "dist", page.path.slice(1), "index.html");
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
}

if (errors.length) {
  console.error("Validação internacional falhou:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Validação internacional aprovada para ${pages.length} páginas.`);
