import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const distDir = resolve(root, "dist");
const budgetPath = resolve(root, "config/bundle-budget.json");
const reportPath = resolve(distDir, "bundle-report.json");

if (!existsSync(distDir)) {
  console.error("ERRO: diretório dist não encontrado. Execute o build antes da análise.");
  process.exit(1);
}

if (!existsSync(budgetPath)) {
  console.error("ERRO: config/bundle-budget.json não encontrado.");
  process.exit(1);
}

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));

function collectFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) files.push(...collectFiles(absolutePath));
    else files.push(absolutePath);
  }

  return files;
}

function summarize(files, extension) {
  const matching = files
    .filter((file) => file.endsWith(extension))
    .map((file) => {
      const content = readFileSync(file);
      return {
        file: relative(distDir, file).replaceAll("\\", "/"),
        rawBytes: content.byteLength,
        gzipBytes: gzipSync(content, { level: 9 }).byteLength,
      };
    })
    .sort((a, b) => b.gzipBytes - a.gzipBytes);

  return {
    files: matching,
    totalRawBytes: matching.reduce((total, file) => total + file.rawBytes, 0),
    totalGzipBytes: matching.reduce((total, file) => total + file.gzipBytes, 0),
    largest: matching[0] ?? null,
  };
}

const files = collectFiles(distDir).filter((file) => file !== reportPath);
const javascript = summarize(files, ".js");
const css = summarize(files, ".css");

const checks = [
  {
    id: "largest-javascript-gzip",
    actualBytes: javascript.largest?.gzipBytes ?? 0,
    limitBytes: budget.maxLargestJavaScriptGzipBytes,
  },
  {
    id: "total-javascript-gzip",
    actualBytes: javascript.totalGzipBytes,
    limitBytes: budget.maxTotalJavaScriptGzipBytes,
  },
  {
    id: "total-css-gzip",
    actualBytes: css.totalGzipBytes,
    limitBytes: budget.maxTotalCssGzipBytes,
  },
].map((check) => ({ ...check, passed: check.actualBytes <= check.limitBytes }));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: checks.every((check) => check.passed) ? "within-budget" : "over-budget",
  budget,
  checks,
  javascript,
  css,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
console.log(`Bundle JS total (gzip): ${formatKiB(javascript.totalGzipBytes)}`);
console.log(`Maior JS (gzip): ${formatKiB(javascript.largest?.gzipBytes ?? 0)}${javascript.largest ? ` — ${javascript.largest.file}` : ""}`);
console.log(`Bundle CSS total (gzip): ${formatKiB(css.totalGzipBytes)}`);
console.log(`Relatório: ${relative(root, reportPath)}`);

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  for (const check of failed) {
    console.error(
      `ERRO: ${check.id} excedeu o orçamento (${formatKiB(check.actualBytes)} > ${formatKiB(check.limitBytes)}).`,
    );
  }
  process.exit(1);
}

console.log("Orçamento do bundle aprovado.");
