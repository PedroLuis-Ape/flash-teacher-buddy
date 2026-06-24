import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function runAudit(args) {
  const result = spawnSync("npm", ["audit", "--json", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 20 * 1024 * 1024,
  });

  const output = result.stdout?.trim();
  if (!output) {
    throw new Error(result.stderr?.trim() || "npm audit não devolveu um relatório JSON.");
  }

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`npm audit devolveu JSON inválido: ${output.slice(0, 500)}`);
  }
}

function counts(report) {
  const values = report?.metadata?.vulnerabilities ?? {};
  return {
    info: Number(values.info ?? 0),
    low: Number(values.low ?? 0),
    moderate: Number(values.moderate ?? 0),
    high: Number(values.high ?? 0),
    critical: Number(values.critical ?? 0),
    total: Number(values.total ?? 0),
  };
}

const production = runAudit(["--omit=dev"]);
const complete = runAudit([]);
const productionCounts = counts(production);
const completeCounts = counts(complete);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    blockProductionHighOrCritical: true,
    blockAnyCritical: true,
    developmentHighIsWarning: true,
  },
  production: { counts: productionCounts, audit: production },
  complete: { counts: completeCounts, audit: complete },
};

writeFileSync("dependency-audit-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Dependências de produção: ${JSON.stringify(productionCounts)}`);
console.log(`Árvore completa: ${JSON.stringify(completeCounts)}`);

const productionBlocked = productionCounts.high > 0 || productionCounts.critical > 0;
const criticalBlocked = completeCounts.critical > 0;

if (completeCounts.high > productionCounts.high) {
  console.warn(`AVISO: há ${completeCounts.high - productionCounts.high} vulnerabilidade(s) alta(s) restrita(s) ao ambiente de desenvolvimento.`);
}
if (productionCounts.moderate > 0) {
  console.warn(`AVISO: há ${productionCounts.moderate} vulnerabilidade(s) moderada(s) em produção.`);
}
if (productionBlocked || criticalBlocked) {
  console.error("ERRO: a política bloqueia vulnerabilidades altas/críticas em produção e qualquer vulnerabilidade crítica na árvore completa.");
  process.exit(1);
}
