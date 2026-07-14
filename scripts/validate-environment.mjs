import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];
const LEGACY_PROJECT_ID = "ymahldldyxvwjeruaxpr";

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
    if (parsedUrl.protocol !== "https:") errors.push(`${label} deve usar HTTPS.`);
    if (parsedUrl.hostname !== `${projectId}.supabase.co`) errors.push(`${label} não corresponde ao project ref oficial.`);
    if (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "") errors.push(`${label} deve apontar para a raiz do projeto.`);
  } catch {
    errors.push(`${label} não é uma URL válida.`);
  }
}

const envSource = readText(".env");
const envFile = envSource ? parseEnv(envSource) : {};
const configSource = readText("supabase/config.toml") ?? "";
const clientSource = readText("src/integrations/supabase/client.ts") ?? "";
const platformRuntimeSource = readText("src/integrations/supabase/platformRuntime.ts") ?? "";
const runtimeBootstrapSource = readText("src/integrations/supabase/runtimeBootstrap.ts") ?? "";
const runtimeFunctionSource = readText("supabase/functions/app-public-config/index.ts") ?? "";
const mainSource = readText("src/main.tsx") ?? "";

const officialProjectId = configSource.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!officialProjectId) errors.push("supabase/config.toml não declara project_id.");
else if (!/^[a-z]{20}$/.test(officialProjectId)) errors.push("project_id não possui o formato esperado de project ref.");

const runtimeProjectId = platformRuntimeSource.match(/OFFICIAL_SUPABASE_PROJECT_ID\s*=\s*"([a-z]{20})"/)?.[1];
if (!runtimeProjectId) errors.push("platformRuntime.ts não declara OFFICIAL_SUPABASE_PROJECT_ID.");
else if (officialProjectId && runtimeProjectId !== officialProjectId) errors.push("O runtime diverge de supabase/config.toml.");

for (const [path, source] of [
  ["platformRuntime.ts", platformRuntimeSource],
  ["runtimeBootstrap.ts", runtimeBootstrapSource],
  ["main.tsx", mainSource],
  ["public-entity-status.js", readText("netlify/edge-functions/public-entity-status.js") ?? ""],
  ["rum-web-vital.js", readText("netlify/edge-functions/rum-web-vital.js") ?? ""],
  ["public-directory-data.mjs", readText("scripts/public-directory-data.mjs") ?? ""],
  ["MCP", readText("src/lib/mcp/index.ts") ?? ""],
]) {
  if (source.includes(LEGACY_PROJECT_ID)) errors.push(`${path} ainda referencia o projeto inativo.`);
}

if (!runtimeBootstrapSource.includes("/functions/v1/app-public-config")) errors.push("runtimeBootstrap.ts não declara app-public-config.");
if (!runtimeBootstrapSource.includes("fetchImpl(OFFICIAL_RUNTIME_ENDPOINT")) errors.push("runtimeBootstrap.ts não consulta o endpoint oficial.");
if (!clientSource.includes("readPlatformRuntime")) errors.push("O cliente Supabase não usa o runtime instalado.");
if (!platformRuntimeSource.includes("__APE_PLATFORM_RUNTIME__")) errors.push("platformRuntime.ts não aceita configuração instalada.");
if (!platformRuntimeSource.includes("assertOfficialPlatformRuntime")) errors.push("platformRuntime.ts não valida o projeto oficial.");
if (platformRuntimeSource.includes("PRODUCTION_DATA_PROJECT_ID")) errors.push("platformRuntime.ts ainda representa uma separação de projetos inexistente.");
if (!mainSource.includes("installPlatformRuntime(await loadOfficialPlatformRuntime())")) errors.push("main.tsx não instala o runtime antes de carregar o App.");
if (mainSource.indexOf("installPlatformRuntime(await loadOfficialPlatformRuntime())") > mainSource.indexOf('import("./App.tsx")')) {
  errors.push("O App é importado antes da instalação do runtime Supabase.");
}

const runtimeSection = configSource.match(/\[functions\.app-public-config\]([\s\S]*?)(?=\n\[|$)/)?.[1];
if (!runtimeSection || !/verify_jwt\s*=\s*false/.test(runtimeSection)) {
  errors.push("app-public-config deve estar explicitamente público em supabase/config.toml.");
}
for (const fragment of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "projectId", "publishableKey"]) {
  if (!runtimeFunctionSource.includes(fragment)) errors.push(`app-public-config não contém: ${fragment}`);
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
if (suppliedCount > 0 && suppliedCount < 3) errors.push("As variáveis VITE_SUPABASE_* devem ser fornecidas como conjunto completo.");
if (suppliedCount === 3) {
  if (suppliedEnv.projectId !== officialProjectId) errors.push("VITE_SUPABASE_PROJECT_ID não corresponde ao projeto oficial.");
  validateProjectUrl(suppliedEnv.url, officialProjectId, "VITE_SUPABASE_URL");
  validatePublicValue(suppliedEnv.publicValue, officialProjectId, "VITE_SUPABASE_PUBLISHABLE_KEY");
}

if (envSource) warnings.push("A .env versionada ainda existe. Prefira variáveis públicas da plataforma.");
warnings.push(`Projeto Supabase único e oficial: ${officialProjectId}.`);

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
for (const error of errors) console.error(`ERRO: ${error}`);
if (errors.length > 0) process.exit(1);
console.log(`Contrato de ambiente válido: projeto único ${officialProjectId}.`);
