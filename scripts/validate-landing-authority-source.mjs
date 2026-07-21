import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pages = JSON.parse(readFileSync(resolve(root, "config/public-seo-pages.json"), "utf8"));
const landingSource = readFileSync(resolve(root, "src/pages/LandingPage.tsx"), "utf8");
const prerenderSource = readFileSync(resolve(root, "scripts/prerender-public-pages.mjs"), "utf8");
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const home = pages.find((page) => page.path === "/");
assert(Boolean(home), "A fonte editorial não contém a rota raiz.");

if (home) {
  assert(home.h1.includes("APE — App Piteco"), "O H1 não identifica APE e App Piteco.");
  assert(home.intro.includes("Apprentice Practice & Enhancement"), "A expansão da sigla APE está ausente.");
  assert(home.author?.name === "Pedro Luis", "A autoria oficial está ausente ou divergente.");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(home.dateModified ?? ""), "A data de revisão deve usar YYYY-MM-DD.");
  assert(home.steps?.length === 6, "O fluxo editorial deve ter exatamente seis passos.");
  assert(home.audiences?.length === 2, "Os blocos de alunos e professores devem estar presentes.");
  assert(home.demo?.items?.length === 3, "A demonstração deve incluir card normal, glossário e camadas.");
  assert(home.faqs?.length >= 4, "A FAQ da home está incompleta.");
  assert(new Set(home.faqs?.map((faq) => faq.question)).size === home.faqs?.length, "A FAQ contém perguntas duplicadas.");
  assert(home.methodology?.text?.includes("não significa garantia"), "O limite das alegações educacionais deve permanecer visível.");

  const links = [
    ...(home.links ?? []),
    ...(home.methodology?.links ?? []),
  ];
  assert(links.every((link) => link.href.startsWith("/")), "Links editoriais devem permanecer internos e auditáveis.");
}

assert(landingSource.includes('from "@/content/public/landingContent"'), "A landing React não consome a fonte editorial compartilhada.");
assert(!landingSource.includes("@/integrations/supabase"), "A landing não pode depender do Supabase para conteúdo editorial.");
assert(!landingSource.includes("useQuery"), "A landing não pode mascarar falhas de descoberta com conteúdo dinâmico.");
assert(prerenderSource.includes('config/public-seo-pages.json'), "O pré-render não consome a fonte editorial compartilhada.");
assert(prerenderSource.includes('"@type": "FAQPage"'), "O pré-render não publica a FAQ estruturada.");

if (errors.length > 0) {
  console.error("Validação da fonte editorial da landing falhou:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Fonte editorial da landing validada sem dependência de dados privados.");
