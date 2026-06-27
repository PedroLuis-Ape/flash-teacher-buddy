import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function readText(relativePath) {
  const filePath = resolve(root, relativePath);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function validatePublicValue(value, projectId, label) {
  if (!value) {
    errors.push(`${label} está ausente.`);
    return;
  }
  if (value.startsWith("sb_publishable_")) return;
  const payload = decodeJwtPayload(value);
  if (!payload) {
    errors.push(`${label} não possui formato reconhecido.`);
    return;
  }
  if (payload.role !== "anon") errors.push(`${label} não possui role anon.`);
  if (payload.ref && payload.ref !== projectId) errors.push(`${label} pertence a outro projeto Supabase.`);
}

function validateProjectUrl(value, projectId, label) {
  try {
    const parsedUrl = new URL(value);
    const expectedHost = `${projectId}.supabase.co`;
    if (parsedUrl.protocol !== "https:") errors.push(`${label} deve usar HTTPS.`);
    if (parsedUrl.hostname !== expectedHost) errors.push(`${label} não corresponde ao project ref oficial.`);
    if (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "") errors.push(`${label} deve apontar para a raiz do projeto.`);
  } catch {
    errors.push(`${label} não é uma URL válida.`);
  }
}

const envSource = readText(".env");
const envFile = envSource ? parseEnv(envSource) : {};
const configSource = readText("supabase/config.toml") ?? "";
const mainSource = readText("src/main.tsx") ?? "";
const clientSource = readText("src/integrations/supabase/client.ts") ?? "";
const runtimeFunctionSource = readText("supabase/functions/app-public-config/index.ts") ?? "";

const configProjectId = configSource.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!configProjectId) errors.push("supabase/config.toml não declara project_id.");
else if (!/^[a-z]{20}$/.test(configProjectId)) errors.push("project_id não possui o formato esperado de project ref.");

const runtimeEndpointProjectId = mainSource.match(
  /https:\/\/([a-z]{20})\.supabase\.co\/functions\/v1\/app-public-config/,
)?.[1];
if (!runtimeEndpointProjectId) {
  errors.push("src/main.tsx não declara o endpoint canônico app-public-config.");
} else if (configProjectId && runtimeEndpointProjectId !== configProjectId) {
  errors.push("O endpoint de configuração pública aponta para outro projeto.");
}
if (/\.functions\.supabase\.co\/app-public-config/.test(mainSource)) {
  errors.push("src/main.tsx usa um formato não canônico de URL para Edge Functions.");
}

for (const [path, source] of [["src/main.tsx", mainSource], ["src/integrations/supabase/client.ts", clientSource]]) {
  if (configProjectId && !source.includes(configProjectId)) errors.push(`${path} não fixa o project ref oficial.`);
}

const runtimeSection = configSource.match(/\[functions\.app-public-config\]([\s\S]*?)(?=\n\[|$)/)?.[1];
if (!runtimeSection || !/verify_jwt\s*=\s*false/.test(runtimeSection)) {
  errors.push("app-public-config deve estar explicitamente público em supabase/config.toml.");
}

for (const requiredFragment of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "projectId", "publishableKey"]) {
  if (!runtimeFunctionSource.includes(requiredFragment)) errors.push(`app-public-config não contém o contrato obrigatório: ${requiredFragment}`);
}

const forbiddenKeyPatterns = [/SERVICE_ROLE/i, /DATABASE_URL/i, /PASSWORD/i, /SUPABASE_ACCESS_TOKEN/i, /JWT_SECRET/i, /PRIVATE_KEY/i, /(?:^|_)SECRET(?:_|$)/i, /(?:^|_)TOKEN(?:_|$)/i, /CREDENTIAL/i];
for (const key of Object.keys(envFile)) {
  if (forbiddenKeyPatterns.some((pattern) => pattern.test(key))) errors.push(`A .env versionada contém uma variável proibida: ${key}`);
  if (!key.startsWith("VITE_")) errors.push(`A .env versionada deve conter apenas valores públicos VITE_: ${key}`);
}

const suppliedEnv = {
  projectId: process.env.VITE_SUPABASE_PROJECT_ID || envFile.VITE_SUPABASE_PROJECT_ID,
  url: process.env.VITE_SUPABASE_URL || envFile.VITE_SUPABASE_URL,
  publicValue: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envFile.VITE_SUPABASE_PUBLISHABLE_KEY,
};
const suppliedCount = Object.values(suppliedEnv).filter(Boolean).length;
if (suppliedCount > 0 && suppliedCount < 3) errors.push("As variáveis VITE_SUPABASE_* devem ser fornecidas como um conjunto completo.");
if (suppliedCount === 3 && configProjectId) {
  if (suppliedEnv.projectId !== configProjectId) errors.push("VITE_SUPABASE_PROJECT_ID não corresponde ao projeto oficial.");
  validateProjectUrl(suppliedEnv.url, configProjectId, "VITE_SUPABASE_URL");
  validatePublicValue(suppliedEnv.publicValue, configProjectId, "VITE_SUPABASE_PUBLISHABLE_KEY");
}

if (envSource) warnings.push("A .env versionada ainda existe. Prefira o endpoint público de runtime ou variáveis seguras da plataforma.");
else warnings.push("A configuração pública é obtida em runtime por app-public-config; nenhuma credencial de frontend fica versionada.");

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
for (const error of errors) console.error(`ERRO: ${error}`);
if (errors.length > 0) process.exit(1);
console.log(`Contrato de ambiente válido para o projeto ${configProjectId}.`);
