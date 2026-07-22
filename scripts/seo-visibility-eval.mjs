import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const reportDir = resolve(root, "reports/seo-visibility");
const reportPath = resolve(reportDir, "latest-eval.json");
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function addCheck({ id, area, points, passed, detail, critical = false }) {
  checks.push({ id, area, points, earned: passed ? points : 0, passed, critical, detail });
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function runNodeScript(path) {
  const result = spawnSync(process.execPath, [resolve(root, path)], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    passed: result.status === 0,
    detail: (result.stdout || result.stderr || `${path} terminou sem saída`).trim(),
  };
}

const pages = JSON.parse(read("config/public-seo-pages.json"));
const home = pages.find((page) => page.path === "/");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const llms = read("public/llms.txt");
const landingSource = read("src/pages/LandingPage.tsx");
const canonicalHost = "https://www.apeeducation.org";

// Clareza da entidade — 20 pontos
addCheck({
  id: "entity-home-identity",
  area: "entity_clarity",
  points: 5,
  critical: true,
  passed: Boolean(home?.h1?.includes("APE") && home?.h1?.includes("App Piteco")),
  detail: "O H1 deve identificar conjuntamente APE e App Piteco.",
});
addCheck({
  id: "entity-title-description",
  area: "entity_clarity",
  points: 4,
  passed: Boolean(home?.title?.includes("APE") && home?.title?.includes("App Piteco") && home?.description?.includes("App Piteco")),
  detail: "Title e description devem manter o alias App Piteco.",
});
addCheck({
  id: "entity-expansion",
  area: "entity_clarity",
  points: 4,
  passed: Boolean(home?.intro?.includes("Apprentice Practice & Enhancement")),
  detail: "A expansão da sigla APE deve estar visível.",
});
addCheck({
  id: "entity-authorship",
  area: "entity_clarity",
  points: 4,
  passed: Boolean(home?.author?.name && home?.author?.text?.includes("APE Education")),
  detail: "Autoria pública e organização devem estar presentes.",
});
addCheck({
  id: "entity-revision-date",
  area: "entity_clarity",
  points: 3,
  passed: /^\d{4}-\d{2}-\d{2}$/.test(home?.dateModified ?? ""),
  detail: "A landing deve possuir data editorial em YYYY-MM-DD.",
});

// Profundidade editorial — 20 pontos
addCheck({
  id: "content-steps",
  area: "editorial_depth",
  points: 4,
  passed: Array.isArray(home?.steps) && home.steps.length >= 5,
  detail: "A explicação de funcionamento precisa de pelo menos cinco etapas.",
});
addCheck({
  id: "content-audiences",
  area: "editorial_depth",
  points: 4,
  passed: Array.isArray(home?.audiences) && home.audiences.length >= 2 && home.audiences.every((audience) => audience.items?.length >= 3),
  detail: "Alunos e professores devem possuir blocos editoriais completos.",
});
addCheck({
  id: "content-demo",
  area: "editorial_depth",
  points: 4,
  passed: Array.isArray(home?.demo?.items) && home.demo.items.length >= 3,
  detail: "A demonstração deve cobrir card normal, glossário e camadas.",
});
addCheck({
  id: "content-methodology-links",
  area: "editorial_depth",
  points: 4,
  passed: includesAll(
    JSON.stringify(home?.methodology?.links ?? []),
    ["/pt-br/metodologia", "/pt-br/evidencias", "/pt-br/fonte-oficial"],
  ),
  detail: "Metodologia, evidências e fonte oficial devem estar conectadas.",
});
addCheck({
  id: "content-faq",
  area: "editorial_depth",
  points: 4,
  passed: Array.isArray(home?.faqs) && home.faqs.length >= 5 && new Set(home.faqs.map((faq) => faq.question)).size === home.faqs.length,
  detail: "A FAQ visível precisa de pelo menos cinco perguntas únicas.",
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
addCheck({
  id: "discovery-sitemap-authority",
  area: "discovery",
  points: 5,
  critical: true,
  passed: includesAll(sitemap, [
    `<loc>${canonicalHost}/</loc>`,
    `<loc>${canonicalHost}/portal</loc>`,
    `<loc>${canonicalHost}/pt-br/fonte-oficial</loc>`,
    `<loc>${canonicalHost}/pt-br/metodologia</loc>`,
    `<loc>${canonicalHost}/pt-br/evidencias</loc>`,
  ]),
  detail: "O sitemap fonte precisa conter as páginas centrais de autoridade.",
});
addCheck({
  id: "discovery-llms-authority",
  area: "discovery",
  points: 5,
  passed: includesAll(llms, [
    `${canonicalHost}/pt-br/fonte-oficial`,
    `${canonicalHost}/pt-br/metodologia`,
    `${canonicalHost}/pt-br/evidencias`,
    `${canonicalHost}/portal`,
  ]),
  detail: "llms.txt deve apontar para as fontes públicas prioritárias.",
});
const privatePatterns = ["/auth", "/dashboard", "/profile", "/settings/", "/special-cards", "/system-status"];
addCheck({
  id: "discovery-no-private-urls",
  area: "discovery",
  points: 5,
  critical: true,
  passed: privatePatterns.every((pattern) => !sitemap.includes(`<loc>${canonicalHost}${pattern}`) && !llms.includes(`${canonicalHost}${pattern}`)),
  detail: "Sitemap e llms.txt não podem publicar rotas privadas ou administrativas.",
});

// Artefato renderizado — 20 pontos
const distIndexPath = resolve(root, "dist/index.html");
const distExists = existsSync(distIndexPath);
const distIndex = distExists ? readFileSync(distIndexPath, "utf8") : "";
addCheck({
  id: "render-dist-exists",
  area: "rendered_artifact",
  points: 5,
  critical: true,
  passed: distExists,
  detail: "Execute `npm run build` antes da avaliação para gerar dist/index.html.",
});
addCheck({
  id: "render-visible-identity",
  area: "rendered_artifact",
  points: 5,
  critical: true,
  passed: distExists && distIndex.includes(home?.h1 ?? "__missing_h1__") && distIndex.includes("Apprentice Practice &amp; Enhancement"),
  detail: "A identidade principal deve existir no HTML inicial pré-renderizado.",
});
addCheck({
  id: "render-canonical",
  area: "rendered_artifact",
  points: 5,
  critical: true,
  passed: distExists && distIndex.includes(`<link rel="canonical" href="${canonicalHost}/"`),
  detail: "O HTML inicial deve publicar o canonical da raiz.",
});
addCheck({
  id: "render-structured-data",
  area: "rendered_artifact",
  points: 5,
  passed: distExists && distIndex.includes('"@type":"SoftwareApplication"') && distIndex.includes('"@type":"FAQPage"'),
  detail: "O artefato deve conter entidades SoftwareApplication e FAQPage coerentes.",
});

// Privacidade e integridade — 20 pontos
const landingValidator = runNodeScript("scripts/validate-landing-authority-source.mjs");
addCheck({
  id: "integrity-landing-validator",
  area: "privacy_integrity",
  points: 5,
  critical: true,
  passed: landingValidator.passed,
  detail: landingValidator.detail,
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
  "garante aprendizagem",
  "clinicamente comprovado",
  "comprovado cientificamente pelo APE",
  "melhor aplicativo de flashcards",
];
const serializedHome = JSON.stringify(home ?? {}).toLocaleLowerCase("pt-BR");
addCheck({
  id: "integrity-no-prohibited-claims",
  area: "privacy_integrity",
  points: 5,
  critical: true,
  passed: prohibitedClaims.every((claim) => !serializedHome.includes(claim.toLocaleLowerCase("pt-BR"))),
  detail: "A landing não pode conter promessas ou superioridade não demonstradas.",
});
addCheck({
  id: "integrity-editorial-source",
  area: "privacy_integrity",
  points: 5,
  passed: landingSource.includes('from "@/content/public/landingContent"') && !landingSource.includes("@/integrations/supabase") && !landingSource.includes("useQuery"),
  detail: "A landing deve usar a fonte editorial compartilhada e não depender de dados privados.",
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
  version: "1.0",
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
for (const [area, result] of Object.entries(areaScores)) {
  console.log(`- ${area}: ${result.score}/${result.max}`);
}
console.log(`Relatório: ${reportPath}`);

if (!report.passed) {
  console.error("A avaliação ainda não atingiu a meta ou possui gate crítico reprovado.");
  process.exit(1);
}
