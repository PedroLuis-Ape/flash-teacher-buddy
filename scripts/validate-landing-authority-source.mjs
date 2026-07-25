import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEditorialMeta, loadEditorialPages } from "./load-editorial-pages.mjs";

const root = process.cwd();
const pages = loadEditorialPages(root);
const meta = loadEditorialMeta(root);
const landingSource = readFileSync(resolve(root, "src/pages/LandingPage.tsx"), "utf8");
const editorialPageSource = readFileSync(resolve(root, "src/components/seo/EditorialPage.tsx"), "utf8");
const structuredDataSource = readFileSync(resolve(root, "src/components/seo/editorialStructuredData.ts"), "utf8");
const prerenderSource = readFileSync(resolve(root, "scripts/prerender-public-pages.mjs"), "utf8");
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const home = pages.find((page) => page.path === "/");
assert(pages.length === 23, `O mapa editorial deve conter 23 rotas, mas contém ${pages.length}.`);
assert(Boolean(home), "A fonte editorial não contém a rota raiz.");
assert(new Set(pages.map((page) => page.path)).size === pages.length, "O mapa editorial contém rotas duplicadas.");

if (home) {
  assert(home.h1.includes("APE — App Piteco"), "O H1 não identifica APE e App Piteco.");
  assert(home.intro.some((paragraph) => paragraph.includes("Apprentice Practice & Enhancement")), "A expansão da sigla APE está ausente.");
  assert(home.author?.name === "Pedro Luis", "A autoria oficial está ausente ou divergente.");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(home.dateModified ?? ""), "A data de revisão deve usar YYYY-MM-DD.");
  assert(home.sections.length >= 8, "A home precisa manter profundidade editorial real.");
  assert(home.faq.length >= 5, "A FAQ da home está incompleta.");
  assert(new Set(home.faq.map((faq) => faq.question)).size === home.faq.length, "A FAQ contém perguntas duplicadas.");
  assert(home.sections.some((section) => section.heading.includes("Metodologia")), "O limite metodológico deve permanecer visível.");
  assert(home.sections.some((section) => section.paragraphs.some((paragraph) => paragraph.includes("Preply"))), "A prova social profissional está ausente da home.");
}

for (const page of pages) {
  assert(page.title.length >= 25, `${page.path}: title editorial curto demais.`);
  assert(page.description.length >= 80, `${page.path}: description editorial curta demais.`);
  assert(page.h1.length >= 15, `${page.path}: H1 editorial curto demais.`);
  assert(page.intro.length >= 1, `${page.path}: introdução ausente.`);
  assert(page.sections.length >= 2, `${page.path}: profundidade editorial insuficiente.`);
  assert(!JSON.stringify(page).includes("PLACEHOLDER"), `${page.path}: placeholder encontrado.`);
  assert(!Object.hasOwn(page, "aggregateRating") && !Object.hasOwn(page, "reviews"), `${page.path}: avaliações de produto não podem ser definidas na fonte editorial.`);

  for (const link of page.relatedLinks) {
    assert(link.href.startsWith("/") || link.href.startsWith("https://"), `${page.path}: link inválido (${link.href}).`);
  }
}

assert(meta.preply.url === "https://preply.com/pt/professor/6349931", "URL oficial da Preply divergente.");
assert(meta.preply.lessons === 1971, "Snapshot verificado de aulas divergente.");
assert(meta.preply.publicReviews === 42, "Snapshot verificado de avaliações divergente.");
assert(meta.preply.publicRating === 4.8, "Snapshot verificado de média divergente.");
assert(meta.preply.stableLessonClaim.includes("1.900"), "Formulação estável para a landing ausente.");

assert(landingSource.includes('EditorialPage path="/"'), "A landing React não consome o mapa editorial mestre.");
assert(!landingSource.includes("@/integrations/supabase"), "A landing não pode depender do Supabase para conteúdo editorial.");
assert(editorialPageSource.includes("text-foreground"), "O H1 precisa usar contraste sólido.");
assert(!editorialPageSource.includes("text-transparent"), "O gradiente transparente não pode voltar ao H1 editorial.");
assert(editorialPageSource.includes("EditorialFaq"), "A FAQ visível precisa fazer parte do layout.");
assert(structuredDataSource.includes("editorialMeta.preply.url"), "O schema Person não referencia a Preply.");
assert(structuredDataSource.includes("github.com/PedroLuis-Ape"), "O schema Person não referencia o GitHub.");
assert(!structuredDataSource.includes("AggregateRating"), "Avaliações da Preply não podem ser atribuídas ao aplicativo.");
assert(prerenderSource.includes("loadEditorialPages"), "O pré-render não consome o mapa editorial mestre.");
assert(prerenderSource.includes('"@type": "FAQPage"'), "O pré-render não publica FAQ estruturada.");
assert(prerenderSource.includes("meta.preply.url"), "O pré-render não publica a fonte externa de autoria.");

if (errors.length > 0) {
  console.error("Validação da fonte editorial mestre falhou:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Mapa editorial mestre validado para ${pages.length} rotas, com autoria, prova social e limites preservados.`);
