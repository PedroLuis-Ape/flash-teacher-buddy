import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pages = JSON.parse(readFileSync(resolve(root, "config/public-seo-methodology-evidence.json"), "utf8"));
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const sitemap = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");
const redirects = readFileSync(resolve(root, "public/_redirects"), "utf8");
const llms = readFileSync(resolve(root, "public/llms.txt"), "utf8");
const errors = [];
const expectedPaths = ["/pt-br/metodologia", "/pt-br/evidencias", "/en/methodology", "/en/evidence"];
const byPath = new Map(pages.map((page) => [page.path, page]));
const doiPattern = /^10\.\d{4,9}\/[\w.()/:;-]+$/i;

if (pages.length !== expectedPaths.length) errors.push(`Esperadas ${expectedPaths.length} páginas, encontradas ${pages.length}.`);
for (const path of expectedPaths) {
  if (!byPath.has(path)) errors.push(`${path}: ausente da configuração`);
}

for (const page of pages) {
  const canonical = `https://www.apeeducation.org${page.path}`;
  if (!expectedPaths.includes(page.path)) errors.push(`${page.path}: rota inesperada`);
  if (!app.includes(`path="${page.path}"`)) errors.push(`${page.path}: rota React ausente`);
  if (!sitemap.includes(`<loc>${canonical}</loc>`)) errors.push(`${page.path}: sitemap ausente`);
  if (!redirects.split(/\r?\n/).some((line) => line.trim().startsWith(`${page.path} `))) errors.push(`${page.path}: redirect estático ausente`);
  if (!llms.includes(canonical)) errors.push(`${page.path}: URL ausente em llms.txt`);
  if (page.schemaType !== "Article") errors.push(`${page.path}: schemaType deve ser Article`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(page.datePublished ?? "")) errors.push(`${page.path}: datePublished inválida`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(page.dateModified ?? "")) errors.push(`${page.path}: dateModified inválida`);
  if (!page.evidenceNotice?.heading || !page.evidenceNotice?.text) errors.push(`${page.path}: aviso de limites ausente`);
  if (!page.evidenceNotice?.text.match(/not|não|no |sem |não possui|has not/i)) errors.push(`${page.path}: aviso não explicita limitação`);
  if ((page.sections?.length ?? 0) < 5) errors.push(`${page.path}: conteúdo metodológico insuficiente`);
  if ((page.references?.length ?? 0) < 5) errors.push(`${page.path}: referências insuficientes`);

  const referenceIds = new Set();
  for (const reference of page.references ?? []) {
    if (!reference.id || referenceIds.has(reference.id)) errors.push(`${page.path}: referência duplicada ou sem id`);
    referenceIds.add(reference.id);
    if (!doiPattern.test(reference.doi ?? "")) errors.push(`${page.path}: DOI inválido ${reference.doi}`);
    if (reference.url !== `https://doi.org/${reference.doi}`) errors.push(`${page.path}: URL DOI divergente para ${reference.id}`);
    if (!reference.authors || !reference.title || !reference.publication || !reference.year) errors.push(`${page.path}: referência incompleta ${reference.id}`);
  }

  const self = page.alternates?.find((alternate) => alternate.hrefLang === page.language);
  if (!self || self.href !== page.path) errors.push(`${page.path}: hreflang próprio inválido`);
  const counterpart = page.alternates?.find((alternate) => alternate.hrefLang !== page.language && alternate.hrefLang !== "x-default");
  if (!counterpart || !byPath.has(counterpart.href)) {
    errors.push(`${page.path}: par localizado ausente`);
  } else {
    const paired = byPath.get(counterpart.href);
    if (!paired.alternates.some((alternate) => alternate.hrefLang === page.language && alternate.href === page.path)) {
      errors.push(`${page.path}: par localizado não é recíproco`);
    }
    const ownDois = page.references.map((reference) => reference.doi).sort();
    const pairedDois = paired.references.map((reference) => reference.doi).sort();
    if (JSON.stringify(ownDois) !== JSON.stringify(pairedDois)) errors.push(`${page.path}: referências divergem do par localizado`);
  }

  const combinedText = JSON.stringify(page).toLowerCase();
  const forbiddenClaims = page.language === "en"
    ? ["guarantees learning", "proven to improve grades", "clinically proven"]
    : ["garante aprendizagem", "comprovado que melhora notas", "clinicamente comprovado"];
  for (const claim of forbiddenClaims) {
    if (combinedText.includes(claim)) errors.push(`${page.path}: afirmação promocional proibida: ${claim}`);
  }
}

if (!app.includes('import("./pages/seo/MethodologyEvidencePage")')) errors.push("Componente MethodologyEvidencePage não está lazy-loaded.");
if (new Set(pages.map((page) => page.path)).size !== pages.length) errors.push("Há rotas duplicadas na configuração.");

if (errors.length) {
  console.error("Validação editorial de metodologia/evidências falhou:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Metodologia/evidências validadas: ${pages.length} páginas, ${pages[0].references.length} referências por página.`);
