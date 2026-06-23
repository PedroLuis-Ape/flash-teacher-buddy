import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8"));
}

const matrix = readJson("docs/implementation/canonization-matrix.json");
const accounts = readJson("docs/implementation/test-accounts-matrix.json");
const errors = [];

if (matrix.schema !== "app-piteco-canonization-matrix") {
  errors.push("Schema inválido para a matriz de canonização.");
}
if (matrix.version !== "1.0") {
  errors.push("Versão inválida para a matriz de canonização.");
}
if (!Array.isArray(matrix.statuses) || matrix.statuses.length === 0) {
  errors.push("A matriz deve declarar os status permitidos.");
}
if (!Array.isArray(matrix.features) || matrix.features.length === 0) {
  errors.push("A matriz deve conter pelo menos uma função.");
}

const allowedStatuses = new Set(matrix.statuses ?? []);
const featureIds = new Set();
const requiredFeatureFields = [
  "id",
  "name",
  "audience",
  "frontend_entry",
  "authorization_source",
  "flag_or_gate",
  "status",
  "required_action",
  "proof_test",
];

for (const [index, feature] of (matrix.features ?? []).entries()) {
  const label = feature?.id || `função no índice ${index}`;
  for (const field of requiredFeatureFields) {
    const value = feature?.[field];
    const emptyArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === "" || emptyArray) {
      errors.push(`${label}: campo obrigatório ausente ou vazio: ${field}`);
    }
  }

  if (featureIds.has(feature.id)) errors.push(`ID de função duplicado: ${feature.id}`);
  featureIds.add(feature.id);

  if (!allowedStatuses.has(feature.status)) {
    errors.push(`${label}: status não permitido: ${feature.status}`);
  }

  const authorization = String(feature.authorization_source ?? "").toLowerCase();
  if (authorization.includes("localstorage") || authorization.includes("vite_owner_email")) {
    errors.push(`${label}: autorização não pode depender de armazenamento local ou e-mail de proprietário.`);
  }

  if (!Array.isArray(feature.audience) || !feature.audience.every((item) => typeof item === "string")) {
    errors.push(`${label}: audience deve ser uma lista de strings.`);
  }
  if (!Array.isArray(feature.frontend_entry) || !feature.frontend_entry.every((item) => typeof item === "string")) {
    errors.push(`${label}: frontend_entry deve ser uma lista de strings.`);
  }
}

if (accounts.schema !== "app-piteco-test-accounts-matrix") {
  errors.push("Schema inválido para a matriz de contas de teste.");
}
if (accounts.version !== "1.0") {
  errors.push("Versão inválida para a matriz de contas de teste.");
}
if (!Array.isArray(accounts.personas) || accounts.personas.length < 6) {
  errors.push("A matriz de contas deve conter pelo menos seis personas.");
}

const personaIds = new Set();
const requiredPersonaFields = [
  "id",
  "role",
  "account_state",
  "must_access",
  "must_not_access",
  "proofs",
];

for (const [index, persona] of (accounts.personas ?? []).entries()) {
  const label = persona?.id || `persona no índice ${index}`;
  for (const field of requiredPersonaFields) {
    const value = persona?.[field];
    const emptyArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === "" || emptyArray) {
      errors.push(`${label}: campo obrigatório ausente ou vazio: ${field}`);
    }
  }

  if (personaIds.has(persona.id)) errors.push(`ID de persona duplicado: ${persona.id}`);
  personaIds.add(persona.id);

  for (const field of ["must_access", "must_not_access", "proofs"]) {
    if (!Array.isArray(persona[field]) || !persona[field].every((item) => typeof item === "string")) {
      errors.push(`${label}: ${field} deve ser uma lista de strings.`);
    }
  }
}

for (const requiredPersona of [
  "teacher-a",
  "teacher-b",
  "student-a",
  "student-b",
  "visitor",
  "incomplete-profile",
]) {
  if (!personaIds.has(requiredPersona)) errors.push(`Persona obrigatória ausente: ${requiredPersona}`);
}

const serializedAccounts = JSON.stringify(accounts);
const realEmailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const populatedCredentialField = /"(?:email|password|token|secret)"\s*:\s*"[^"\s]+"/i;
if (realEmailPattern.test(serializedAccounts) || populatedCredentialField.test(serializedAccounts)) {
  errors.push("A matriz de contas não pode conter credenciais preenchidas.");
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERRO: ${error}`));
  process.exit(1);
}

const counts = Object.fromEntries(
  [...allowedStatuses].map((status) => [
    status,
    matrix.features.filter((feature) => feature.status === status).length,
  ]),
);

console.log(`Matriz de canonização válida: ${matrix.features.length} funções.`);
console.log(`Matriz de contas válida: ${accounts.personas.length} personas.`);
console.log(JSON.stringify(counts));
