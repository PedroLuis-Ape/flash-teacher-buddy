import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "docs/implementation/canonization-matrix.json");
const matrix = JSON.parse(readFileSync(filePath, "utf8"));
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
const seenIds = new Set();
const requiredFields = [
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
  const label = feature?.id || `índice ${index}`;
  for (const field of requiredFields) {
    const value = feature?.[field];
    const emptyArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === "" || emptyArray) {
      errors.push(`${label}: campo obrigatório ausente ou vazio: ${field}`);
    }
  }

  if (seenIds.has(feature.id)) errors.push(`ID duplicado: ${feature.id}`);
  seenIds.add(feature.id);

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
console.log(JSON.stringify(counts));
