import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const functionsRoot = resolve(root, "supabase/functions");
const configPath = resolve(root, "supabase/config.toml");
const policyPath = resolve(root, "config/security-audit.json");
const reportPath = resolve(root, "security-audit-report.json");
const errors = [];

if (!existsSync(functionsRoot)) errors.push("Diretório de funções ausente.");
if (!existsSync(configPath)) errors.push("Configuração das funções ausente.");
if (!existsSync(policyPath)) errors.push("Política de funções ausente.");

const configSource = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const policy = existsSync(policyPath)
  ? JSON.parse(readFileSync(policyPath, "utf8"))
  : { publicFunctions: {}, serviceRoleFunctions: [] };

const publicFunctions = new Set(Object.keys(policy.publicFunctions ?? {}));
const elevatedFunctions = new Set(policy.serviceRoleFunctions ?? []);
const directories = existsSync(functionsRoot)
  ? readdirSync(functionsRoot).filter((name) => statSync(join(functionsRoot, name)).isDirectory())
  : [];

function readVerifySetting(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = configSource.match(
    new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
  );
  if (!section) return null;
  return section[1].match(/verify_jwt\s*=\s*(true|false)/)?.[1] ?? null;
}

const inventory = directories.map((name) => {
  const indexPath = join(functionsRoot, name, "index.ts");
  const verifyJwt = readVerifySetting(name);
  const isPublic = publicFunctions.has(name);
  const isElevated = elevatedFunctions.has(name);

  if (!existsSync(indexPath)) errors.push(`${name}: index.ts ausente.`);
  if (verifyJwt === null) errors.push(`${name}: verify_jwt não declarado.`);
  if (isPublic && verifyJwt !== "false") {
    errors.push(`${name}: função pública deve declarar verify_jwt = false.`);
  }
  if (!isPublic && verifyJwt !== "true") {
    errors.push(`${name}: função privada deve declarar verify_jwt = true.`);
  }
  if (isPublic && isElevated) {
    errors.push(`${name}: uma função pública não pode estar na lista elevada.`);
  }

  return {
    name,
    verifyJwt,
    public: isPublic,
    elevated: isElevated,
    hasEntryPoint: existsSync(indexPath),
  };
});

for (const name of publicFunctions) {
  if (!directories.includes(name)) errors.push(`${name}: função pública inexistente.`);
}
for (const name of elevatedFunctions) {
  if (!directories.includes(name)) errors.push(`${name}: função elevada inexistente.`);
}

const configuredNames = [...configSource.matchAll(/^\[functions\.([^\]]+)\]/gm)].map((match) => match[1]);
for (const name of configuredNames) {
  if (!directories.includes(name)) errors.push(`${name}: configuração sem diretório correspondente.`);
}
for (const name of directories) {
  if (!configuredNames.includes(name)) errors.push(`${name}: diretório sem configuração correspondente.`);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 ? "passed" : "failed",
  summary: {
    functions: inventory.length,
    publicFunctions: inventory.filter((item) => item.public).length,
    elevatedFunctions: inventory.filter((item) => item.elevated).length,
    errors: errors.length,
  },
  inventory,
  errors,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const error of errors) console.error(`ERRO: ${error}`);
console.log(`Auditoria concluída: ${inventory.length} funções, ${errors.length} erros.`);
if (errors.length > 0) process.exit(1);
