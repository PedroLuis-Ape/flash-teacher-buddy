import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const runtimeSource = readFileSync(
  resolve(process.cwd(), "src/integrations/supabase/platformRuntime.ts"),
  "utf8",
);
const productionProjectId = runtimeSource.match(
  /PRODUCTION_DATA_PROJECT_ID\s*=\s*"([a-z]{20})"/,
)?.[1];

if (!productionProjectId) {
  throw new Error("PRODUCTION_DATA_PROJECT_ID nao encontrado no contrato de runtime.");
}

const files = {
  root: "sitemap.xml",
  static: "sitemap-static.xml",
  teachers: "sitemap-teachers.xml",
  folders: "sitemap-folders.xml",
  lists: "sitemap-lists.xml",
  teacherReport: "public-teacher-prerender-report.json",
  folderReport: "public-learning-resource-prerender-report.json",
  listReport: "public-learning-list-prerender-report.json",
};

for (const filename of Object.values(files)) {
  if (!existsSync(resolve(distDir, filename))) {
    throw new Error(`Artefato SEO obrigatorio ausente: dist/${filename}`);
  }
}

const read = (filename) => readFileSync(resolve(distDir, filename), "utf8");
const readJson = (filename) => JSON.parse(read(filename));
const locCount = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].length;

const rootSitemap = read(files.root);
const teacherReport = readJson(files.teacherReport);
const folderReport = readJson(files.folderReport);
const listReport = readJson(files.listReport);

const checks = [];
const diagnostics = [];
const check = (code, passed, detail) => {
  checks.push({ code, passed, detail });
  if (!passed) diagnostics.push({ code, detail });
};

for (const segment of [files.static, files.teachers, files.folders, files.lists]) {
  check(
    `sitemap-index:${segment}`,
    rootSitemap.includes(`<loc>https://www.apeeducation.org/${segment}</loc>`),
    `O indice precisa apontar para ${segment}.`,
  );
}

const projectIds = [
  teacherReport.runtimeProjectId,
  folderReport.runtimeProjectId,
  listReport.runtimeProjectId,
];
check(
  "runtime:production-project",
  projectIds.every((projectId) => projectId === productionProjectId),
  `Todos os relatorios devem usar ${productionProjectId}; recebidos: ${projectIds.join(", ")}.`,
);
check(
  "discovery:available",
  [teacherReport.discoveryMode, folderReport.discoveryMode, listReport.discoveryMode]
    .every((mode) => mode && mode !== "unavailable"),
  "Nenhuma etapa de descoberta pode terminar como unavailable.",
);
check(
  "teachers:non-empty",
  teacherReport.teacherCount > 0,
  `Professores publicos descobertos: ${teacherReport.teacherCount}.`,
);
check(
  "folders:consistent",
  folderReport.resourceCount > 0 && folderReport.resourceCount === teacherReport.folderCount,
  `Pastas no diretorio: ${teacherReport.folderCount}; paginas de pasta: ${folderReport.resourceCount}.`,
);
check(
  "lists:consistent",
  folderReport.listCount > 0 && listReport.listCount === folderReport.listCount,
  `Listas declaradas nas pastas: ${folderReport.listCount}; paginas de lista: ${listReport.listCount}.`,
);
check(
  "fallback:no-folder-failures",
  Number(folderReport.failedFolderCount ?? 0) === 0,
  `Falhas ao carregar listas de pastas: ${folderReport.failedFolderCount ?? 0}.`,
);
check(
  "fallback:no-preview-failures",
  Number(listReport.failedPreviewCount ?? 0) === 0,
  `Falhas ao carregar previas de listas: ${listReport.failedPreviewCount ?? 0}.`,
);

const sitemapCounts = {
  static: locCount(read(files.static)),
  teachers: locCount(read(files.teachers)),
  folders: locCount(read(files.folders)),
  lists: locCount(read(files.lists)),
};
check("sitemap:teachers", sitemapCounts.teachers === teacherReport.teacherCount, `Sitemap de professores: ${sitemapCounts.teachers}; relatorio: ${teacherReport.teacherCount}.`);
check("sitemap:folders", sitemapCounts.folders === folderReport.resourceCount, `Sitemap de pastas: ${sitemapCounts.folders}; relatorio: ${folderReport.resourceCount}.`);
check("sitemap:lists", sitemapCounts.lists === listReport.listCount, `Sitemap de listas: ${sitemapCounts.lists}; relatorio: ${listReport.listCount}.`);

const report = {
  contractVersion: 1,
  generatedAt: new Date().toISOString(),
  status: diagnostics.length ? "failed" : "passed",
  productionProjectId,
  runtimeSources: {
    teachers: teacherReport.runtimeSource,
    folders: folderReport.runtimeSource,
    lists: listReport.runtimeSource,
  },
  discoveryModes: {
    teachers: teacherReport.discoveryMode,
    folders: folderReport.discoveryMode,
    lists: listReport.discoveryMode,
  },
  counts: {
    teachers: teacherReport.teacherCount,
    folders: folderReport.resourceCount,
    lists: listReport.listCount,
    previewCards: listReport.previewCardCount,
    sitemapUrls: Object.values(sitemapCounts).reduce((sum, count) => sum + count, 0),
    sitemapSegments: sitemapCounts,
  },
  checks,
  diagnostics,
};

writeFileSync(
  resolve(distDir, "seo-publication-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

if (diagnostics.length) {
  console.error("Contrato de publicacao SEO falhou:");
  for (const diagnostic of diagnostics) console.error(`- ${diagnostic.code}: ${diagnostic.detail}`);
  process.exit(1);
}

console.log(
  `Contrato SEO aprovado: ${report.counts.teachers} professor(es), ${report.counts.folders} pasta(s), ${report.counts.lists} lista(s), ${report.counts.sitemapUrls} URLs.`,
);
