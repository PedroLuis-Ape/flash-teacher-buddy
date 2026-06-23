import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readText(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const backend = readJson("docs/implementation/backend-evidence.template.json");
const runtime = readJson("docs/implementation/runtime-baseline.template.json");
const findings = readJson("docs/implementation/phase-zero-findings.json");
const collector = readText("scripts/collect-phase-zero-browser-evidence.js");
const errors = [];

if (backend.schema !== "app-piteco-backend-evidence" || backend.version !== "1.0") {
  errors.push("Contrato inválido para evidência de backend.");
}
if (backend.status !== "pending") {
  errors.push("O template de backend deve permanecer pending até captura real.");
}
if (backend.documented_project_ref !== "ymahldldyxvwjeruaxpr") {
  errors.push("O template deve preservar o project ref documentado atual.");
}
for (const service of ["auth", "rest", "rpc", "storage", "functions"]) {
  if (!backend.services?.[service]) errors.push(`Serviço obrigatório ausente: ${service}`);
}

if (runtime.schema !== "app-piteco-runtime-baseline" || runtime.version !== "1.0") {
  errors.push("Contrato inválido para baseline de runtime.");
}
if (runtime.status !== "pending") {
  errors.push("O template de runtime deve permanecer pending até captura real.");
}
const profileIds = new Set((runtime.profiles ?? []).map((profile) => profile.id));
for (const profile of ["desktop-standard", "android-midrange"]) {
  if (!profileIds.has(profile)) errors.push(`Perfil de baseline ausente: ${profile}`);
}
for (const profile of runtime.profiles ?? []) {
  for (const field of ["cold_boot", "resume", "study_navigation", "folders"]) {
    if (!profile[field]) errors.push(`${profile.id}: cenário obrigatório ausente: ${field}`);
  }
  if (profile.study_navigation?.forward_cards !== 20) {
    errors.push(`${profile.id}: baseline deve prever 20 avanços.`);
  }
  if (profile.study_navigation?.backward_cards !== 10) {
    errors.push(`${profile.id}: baseline deve prever 10 retornos.`);
  }
}

if (findings.schema !== "app-piteco-phase-zero-findings" || findings.version !== "1.0") {
  errors.push("Contrato inválido para o registro de falhas da Fase 0.");
}
const allowedSeverities = new Set(findings.allowed_severities ?? []);
const allowedStatuses = new Set(findings.allowed_statuses ?? []);
const findingIds = new Set();
const requiredFindingFields = [
  "id",
  "severity",
  "title",
  "status",
  "scope",
  "evidence",
  "risk",
  "required_action",
  "exit_proof",
];
for (const [index, finding] of (findings.findings ?? []).entries()) {
  const label = finding?.id || `achado no índice ${index}`;
  for (const field of requiredFindingFields) {
    const value = finding?.[field];
    const emptyArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === "" || emptyArray) {
      errors.push(`${label}: campo obrigatório ausente ou vazio: ${field}`);
    }
  }
  if (findingIds.has(finding.id)) errors.push(`ID de achado duplicado: ${finding.id}`);
  findingIds.add(finding.id);
  if (!allowedSeverities.has(finding.severity)) {
    errors.push(`${label}: severidade não permitida: ${finding.severity}`);
  }
  if (!allowedStatuses.has(finding.status)) {
    errors.push(`${label}: status não permitido: ${finding.status}`);
  }
  if (!Array.isArray(finding.evidence) || !finding.evidence.every((item) => typeof item === "string")) {
    errors.push(`${label}: evidence deve ser uma lista de strings.`);
  }
}
if ((findings.findings ?? []).filter((finding) => finding.severity === "P0").length < 2) {
  errors.push("O registro deve preservar os dois bloqueios P0 de ambiente e runtime publicado.");
}

const serialized = `${JSON.stringify(backend)}${JSON.stringify(runtime)}${JSON.stringify(findings)}`;
const forbiddenEvidencePatterns = [
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./,
  /sb_(?:secret|publishable)_[a-zA-Z0-9_-]+/i,
  /service_role\s*[:=]\s*["'][^"']+/i,
  /authorization\s*:\s*["'][^"']+/i,
  /password\s*:\s*["'][^"']+/i,
];
if (forbiddenEvidencePatterns.some((pattern) => pattern.test(serialized))) {
  errors.push("Evidências da Fase 0 contêm padrão semelhante a credencial ou segredo preenchido.");
}

const forbiddenCollectorApis = [
  "document.cookie",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "getAllResponseHeaders",
  "authorizationHeader",
];
for (const api of forbiddenCollectorApis) {
  if (collector.includes(api)) errors.push(`Coletor não pode acessar: ${api}`);
}
if (!collector.includes("sanitizeResource")) {
  errors.push("Coletor deve sanitizar URLs de recursos.");
}
if (!collector.includes("cookies_collected: false")) {
  errors.push("Coletor deve declarar que cookies não são coletados.");
}
if (!collector.includes("query_values_collected: false")) {
  errors.push("Coletor deve declarar que valores de query não são coletados.");
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERRO: ${error}`));
  process.exit(1);
}

const counts = Object.fromEntries(
  [...allowedSeverities].map((severity) => [
    severity,
    findings.findings.filter((finding) => finding.severity === severity).length,
  ]),
);
console.log("Templates, coletor e registro de falhas da Fase 0 válidos.");
console.log(JSON.stringify(counts));
