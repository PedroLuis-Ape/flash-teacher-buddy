import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pages = [
  ...JSON.parse(readFileSync(resolve(root, "config/public-seo-pages-international.json"), "utf8")),
  ...JSON.parse(readFileSync(resolve(root, "config/public-seo-official-sources.json"), "utf8")),
  ...JSON.parse(readFileSync(resolve(root, "config/public-seo-methodology-evidence.json"), "utf8")),
];
const sitemap = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");
const redirects = readFileSync(resolve(root, "public/_redirects"), "utf8");
const llms = readFileSync(resolve(root, "public/llms.txt"), "utf8");
const appSource = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const errors = [];
const byPath = new Map(pages.map((page) => [page.path, page]));

for (const page of pages) {
  const expectedUrl = `https://www.apeeducation.org${page.path}`;
  if (!sitemap.includes(`<loc>${expectedUrl}</loc>`)) errors.push(`${page.path}: ausente no sitemap`);
  if (!redirects.split(/\r?\n/).some((line) => line.trim().startsWith(`${page.path} `))) {
    errors.push(`${page.path}: ausente antes do fallback em _redirects`);
  }
  if (!appSource.includes(`path="${page.path}"`)) errors.push(`${page.path}: rota ausente em src/App.tsx`);
  if ((page.officialSource || page.schemaType === "Article") && !llms.includes(expectedUrl)) {
    errors.push(`${page.path}: fonte editorial ausente em llms.txt`);
  }

  const self = page.alternates.find((alternate) => alternate.hrefLang === page.language);
  if (!self || self.href !== page.path) errors.push(`${page.path}: alternate próprio inválido`);

  const counterpart = page.alternates.find((alternate) => alternate.hrefLang !== page.language && alternate.hrefLang !== "x-default");
  if (!counterpart) {
    errors.push(`${page.path}: par localizado ausente`);
    continue;
  }

  const pairedPage = byPath.get(counterpart.href);
  if (!pairedPage) {
    errors.push(`${page.path}: par ${counterpart.href} não existe na configuração`);
    continue;
  }

  const reciprocal = pairedPage.alternates.some((alternate) => alternate.hrefLang === page.language && alternate.href === page.path);
  if (!reciprocal) errors.push(`${page.path}: hreflang não é recíproco com ${counterpart.href}`);
}

const paths = pages.map((page) => page.path);
if (new Set(paths).size !== paths.length) errors.push("Há rotas internacionais duplicadas.");

if (errors.length) {
  console.error("Validação das fontes internacionais falhou:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Fontes internacionais validadas: ${pages.length} páginas e pares hreflang recíprocos.`);
