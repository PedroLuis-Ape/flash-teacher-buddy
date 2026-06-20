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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

const envSource = readText(".env");
const envFile = envSource ? parseEnv(envSource) : {};
const env = { ...envFile, ...process.env };
const configSource = readText("supabase/config.toml");

const requiredKeys = [
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

for (const key of requiredKeys) {
  if (!env[key]) errors.push(`Variável obrigatória ausente: ${key}`);
}

const forbiddenKeyPatterns = [
  /SERVICE_ROLE/i,
  /DATABASE_URL/i,
  /POSTGRES.*PASSWORD/i,
  /SUPABASE_ACCESS_TOKEN/i,
  /JWT_SECRET/i,
  /PRIVATE_KEY/i,
  /SECRET_KEY/i,
];

for (const key of Object.keys(envFile)) {
  if (forbiddenKeyPatterns.some((pattern) => pattern.test(key))) {
    errors.push(`A .env versionada contém uma variável proibida: ${key}`);
  }

  if (!key.startsWith("VITE_")) {
    errors.push(`A .env versionada deve conter apenas valores públicos VITE_: ${key}`);
  }
}

const projectId = env.VITE_SUPABASE_PROJECT_ID;
const supabaseUrl = env.VITE_SUPABASE_URL;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (projectId && !/^[a-z]{20}$/.test(projectId)) {
  errors.push("VITE_SUPABASE_PROJECT_ID não possui o formato esperado de project ref.");
}

if (projectId && supabaseUrl) {
  try {
    const parsedUrl = new URL(supabaseUrl);
    const expectedHost = `${projectId}.supabase.co`;

    if (parsedUrl.protocol !== "https:") {
      errors.push("VITE_SUPABASE_URL deve usar HTTPS.");
    }
    if (parsedUrl.hostname !== expectedHost) {
      errors.push("VITE_SUPABASE_URL não corresponde ao VITE_SUPABASE_PROJECT_ID.");
    }
    if (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "") {
      errors.push("VITE_SUPABASE_URL deve apontar para a raiz do projeto.");
    }
  } catch {
    errors.push("VITE_SUPABASE_URL não é uma URL válida.");
  }
}

if (!configSource) {
  errors.push("supabase/config.toml não foi encontrado.");
} else {
  const configProjectId = configSource.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!configProjectId) {
    errors.push("supabase/config.toml não declara project_id.");
  } else if (projectId && configProjectId !== projectId) {
    errors.push("supabase/config.toml e o frontend apontam para projetos diferentes.");
  }
}

if (publishableKey) {
  if (publishableKey.startsWith("sb_publishable_")) {
    // Modern publishable key. No JWT payload to inspect.
  } else {
    const payload = decodeJwtPayload(publishableKey);
    if (!payload) {
      errors.push("VITE_SUPABASE_PUBLISHABLE_KEY não é uma chave publicável reconhecida.");
    } else {
      if (payload.role !== "anon") {
        errors.push("A chave do frontend não possui role anon.");
      }
      if (projectId && payload.ref && payload.ref !== projectId) {
        errors.push("A chave publicável pertence a outro projeto Supabase.");
      }
    }
  }
}

if (envSource) {
  warnings.push(
    "A .env ainda é versionada por compatibilidade de deploy. Ela deve permanecer limitada a valores públicos VITE_ até a migração para variáveis da plataforma.",
  );
} else {
  warnings.push("A .env não está versionada; o build depende das variáveis configuradas na plataforma.");
}

for (const warning of warnings) console.warn(`AVISO: ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERRO: ${error}`);
  process.exit(1);
}

console.log(`Contrato de ambiente válido para o projeto ${projectId}.`);
