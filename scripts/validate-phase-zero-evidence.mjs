import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8"));
}

const backend = readJson("docs/implementation/backend-evidence.template.json");
const runtime = readJson("docs/implementation/runtime-baseline.template.json");
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

const serialized = `${JSON.stringify(backend)}${JSON.stringify(runtime)}`;
const forbidden = [
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./,
  /sb_(?:secret|publishable)_[a-zA-Z0-9_-]+/i,
  /service_role/i,
  /authorization\s*:/i,
  /password\s*:/i,
];
if (forbidden.some((pattern) => pattern.test(serialized))) {
  errors.push("Templates de evidência contêm padrão semelhante a credencial ou segredo.");
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERRO: ${error}`));
  process.exit(1);
}

console.log("Templates de evidência da Fase 0 válidos.");
