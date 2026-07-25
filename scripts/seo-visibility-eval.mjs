import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadEditorialMeta, loadEditorialPages } from "./load-editorial-pages.mjs";

const root = process.cwd();
const reportDir = resolve(root, "reports/seo-visibility");
const reportPath = resolve(reportDir, "latest-eval.json");
const pages = loadEditorialPages(root);
const meta = loadEditorialMeta(root);
const home = pages.find((page) => page.path === "/");
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function addCheck({ id, area, points, passed, detail, critical = false }) {
  checks.push({ id, area, points, earned: passed ? points : 0, passed, critical, detail });
}

function runNodeScript(path) {
  const result = spawnSync(process.execPath, [resolve(root, path)], { cwd: root, encoding: "utf8" });
  return {
    passed: result.status === 0,
    detail: (result.stdout || result.stderr || `${path} terminou sem saída`).trim(),
  };
}

function serialized(value) {
  return JSON.stringify(value ?? {}).toLocaleLowerCase("pt-BR");
}

const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const llms = read("public/llms.txt");
const landingSource = read("src/pages/LandingPage.tsx");
const layoutSource = read("src/components/seo/EditorialPage.tsx");
const schemaSource = read("src/components/seo/editorialStructuredData.ts");
const canonicalHost = meta.siteUrl;

// Clareza da entidade — 20 pontos
addCheck({
  id: "entity-home-identity",
  area: "entity_clarity",
  points: 4,
  critical: true,
  passed: Boolean(home?.h1.includes("APE — App Piteco")),
  detail: "O H1 da home precisa identificar APE e App Piteco.",
});
addCheck({
  id: "entity-expansion",
  area: "entity_clarity",
  points: 4,
  passed: Boolean(home?.intro.some((paragraph) => paragraph.includes("Apprentice Practice & Enhancement"))),
  detail: "A expansão da sigla APE deve estar visível.",
});
addCheck({
  id: "entity-authorship",
  area: "entity_clarity",
  points: 4,
  passed: pages.every((page) => page.author?.name === "Pedro Luis") && schemaSource.includes("APE Education"),
  detail: "Autoria e organização precisam ser consistentes nas páginas.",
});
addCheck({
  id: "entity-external-sources",
  area: "entity_clarity",
  points: 4,
  passed: schemaSource.includes("editorialMeta.preply.url") && schemaSource.includes("github.com/PedroLuis-Ape"),
  detail: "A entidade Person deve ligar autoria à Preply e ao GitHub.",
});
addCheck({
  id: "entity-revision-date",
  area: "entity_clarity",
  points: 4,
  passed: pages.every((page) => /^\d{4}-\d{2}-\d{2}$/.test(page.dateModified)),
  detail: "Todas as páginas precisam de data editorial em YYYY-MM-DD.",
});

// Profundidade editorial — 20 pontos
addCheck({
  id: "content-route-inventory",
  area: "editorial_depth",
  points: 4,
  critical: true,
  passed: pages.length === 23 && new Set(pages.map((page) => page.path)).size === 23,
  detail: "O mapa mestre deve conter exatamente 23 rotas únicas.",
});
addCheck({
  id: "content-depth",
  area: "editorial_depth",
  points: 4,
  passed: pages.every((page) => page.intro.length >= 1 && page.sections.length >= 2),
  detail: "Cada rota precisa de introdução e seções substanciais.",
});
addCheck({
  id: "content-methodology-evidence",
  area: "editorial_depth",
  points: 4,
  passed: ["/pt-br/metodologia", "/pt-br/evidencias", "/en/methodology", "/en/evidence"].every((path) => pages.some((page) => page.path === path && (page.references?.length ?? 0) >= 6)),
  detail: "Metodologia e evidências precisam manter referências verificáveis.",
});
addCheck({
  id: "content-faq",
  area: "editorial_depth",
  points: 4,
  passed: (home?.faq.length ?? 0) >= 5 && new Set(home?.faq.map((faq) => faq.question)).size === home?.faq.length,
  detail: "A home precisa de FAQ visível com perguntas únicas.",
});
addCheck({
  id: "content-dynamic-models",
  area: "editorial_depth",
  points: 4,
  passed: existsSync(resolve(root, "src/components/seo/DynamicPublicEditorialNote.tsx")),
  detail: "Perfis, pastas, listas e coleções públicas precisam de contexto editorial.",
});

// Descoberta e rastreabilidade — 20 pontos
addCheck({
  id: "discovery-robots",
  area: "discovery",
  points: 5,
  critical: true,
  passed: /User-agent:\s*\*/i.test(robots) && /Allow:\s*\//i.test(robots) && robots.includes(`${canonicalHost}/sitemap.xml`),
  detail: "robots.txt deve permitir páginas públicas e anunciar o sitemap canônico.",
});
const sitemapPaths = pages.map((page) => `<loc>${canonicalHost}${page.path === "/" ? "/" : page.path}</loc>`);
addCheck({
  id: "discovery-sitemap-editorial",
  area: "discovery",
  points: 5,
  critical: true,
  passed: sitemapPaths.every((entry) => sitemap.includes(entry)),
  detail: "O sitemap fonte precisa conter todas as 23 rotas editoriais.",
});
addCheck({
  id: "discovery-llms-authority",
  area: "discovery",
  points: 5,
  passed: ["/pt-br/fonte-oficial", "/pt-br/metodologia", "/pt-br/evidencias", "/portal"].every((path) => llms.includes(`${canonicalHost}${path}`)),
  detail: "llms.txt deve apontar para as fontes públicas prioritárias.",
});
const privatePatterns = ["/auth", "/dashboard", "/profile", "/settings/", "/special-cards", "/system-status"];
addCheck({
  id: "discovery-no-private-urls",
  area: "discovery",
  points: 5,
  critical: true,
  passed: privatePatterns.every((pattern) => !sitemap.includes(`<loc>${canonicalHost}${pattern}`) && !llms.includes(`${canonicalHost}${pattern}`)),
  detail: "Sitemap e llms.txt não podem publicar rotas privadas.",
});

// Artefato renderizado — 20 pontos
const distIndexPath = resolve(root, "dist/index.html");
const distExists = existsSync(distIndexPath);
const distIndex = distExists ? readFileSync(distIndexPath, "utf8") : "";
addCheck({
  id: "render-dist-exists",
  area: "rendered_artifact",
  points: 4,
  critical: true,
  passed: distExists,
  detail: "Execute o build para gerar dist/index.html.",
});
addCheck({
  id: "render-visible-identity",
  area: "rendered_artifact",
  points: 4,
  critical: true,
  passed: distExists && distIndex.includes(home?.h1 ?? "__missing_h1__") && distIndex.includes("Apprentice Practice &amp; Enhancement"),
  detail: "A identidade principal deve existir no HTML inicial.",
});
addCheck({
  id: "render-canonical",
  area: "rendered_artifact",
  points: 4,
  critical: true,
  passed: distExists && distIndex.includes(`<link rel="canonical" href="${canonicalHost}/"`),
  detail: "O HTML inicial deve publicar o canonical da raiz.",
});
addCheck({
  id: "render-structured-data",
  area: "rendered_artifact",
  points: 4,
  passed: distExists && distIndex.includes('"SoftwareApplication"') && distIndex.includes('"FAQPage"') && distIndex.includes(meta.preply.url),
  detail: "O artefato deve conter aplicação, FAQ e fonte externa de autoria.",
});
addCheck({
  id: "render-no-placeholder",
  area: "rendered_artifact",
  points: 4,
  critical: true,
  passed: distExists && !distIndex.includes("PLACEHOLDER"),
  detail: "O artefato não pode conter placeholder editorial.",
});

// Privacidade e integridade — 20 pontos
const editorialValidator = runNodeScript("scripts/validate-landing-authority-source.mjs");
addCheck({
  id: "integrity-editorial-validator",
  area: "privacy_integrity",
  points: 5,
  critical: true,
  passed: editorialValidator.passed,
  detail: editorialValidator.detail,
});
const privacyValidator = runNodeScript("scripts/validate-public-author-privacy.mjs");
addCheck({
  id: "integrity-privacy-validator",
  area: "privacy_integrity",
  points: 5,
  critical: true,
  passed: privacyValidator.passed,
  detail: privacyValidator.detail,
});
const prohibitedClaims = [
  "aprendizado garantido pelo ape",
  "aprendizagem garantida pelo ape",
  "fluência garantida",
  "clinicamente comprovado",
  "comprovado cientificamente pelo ape",
  "melhor aplicativo de flashcards",
  "superior a todos os concorrentes",
];
addCheck({
  id: "integrity-no-prohibited-claims",
  area: "privacy_integrity",
  points: 5,
  critical: true,
  passed: prohibitedClaims.every((claim) => !serialized(pages).includes(claim)),
  detail: "O conteúdo não pode conter promessas ou superioridade não demonstradas.",
});
addCheck({
  id: "integrity-editorial-source",
  area: "privacy_integrity",
  points: 5,
  passed: landingSource.includes('EditorialPage path="/"') && layoutSource.includes("EditorialFaq") && !landingSource.includes("@/integrations/supabase"),
  detail: "A landing deve usar o mapa compartilhado e manter FAQ visível sem dados privados.",
});

const score = checks.reduce((sum, check) => sum + check.earned, 0);
const maxScore = checks.reduce((sum, check) => sum + check.points, 0);
const criticalFailures = checks.filter((check) => check.critical && !check.passed);
const areaScores = Object.fromEntries(
  [...new Set(checks.map((check) => check.area))].map((area) => {
    const areaChecks = checks.filter((check) => check.area === area);
    return [area, {
      score: areaChecks.reduce((sum, check) => sum + check.earned, 0),
      max: areaChecks.reduce((sum, check) => sum + check.points, 0),
    }];
  }),
);

const report = {
  schema: "ape-seo-visibility-eval",
  version: "2.0",
  generated_at: new Date().toISOString(),
  score,
  max_score: maxScore,
  target_score: 95,
  passed: score >= 95 && criticalFailures.length === 0,
  critical_failures: criticalFailures.map((check) => check.id),
  area_scores: areaScores,
  checks,
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`APE SEO visibility score: ${score}/${maxScore}`);
for (const [area, result] of Object.entries(areaScores)) console.log(`- ${area}: ${result.score}/${result.max}`);
console.log(`Relatório: ${reportPath}`);

if (!report.passed) {
  console.error("A avaliação ainda não atingiu a meta ou possui gate crítico reprovado.");
  process.exit(1);
}
