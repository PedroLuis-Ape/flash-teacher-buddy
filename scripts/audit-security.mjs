import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const functionsRoot = resolve(root, "supabase/functions");
const configPath = resolve(root, "supabase/config.toml");
const policyPath = resolve(root, "config/security-audit.json");
const reportPath = resolve(root, "security-audit-report.json");
const administrativeKeyName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const errors = [];
const warnings = [];

if (!existsSync(functionsRoot)) errors.push("Diretório de funções ausente.");
if (!existsSync(configPath)) errors.push("Configuração das funções ausente.");
if (!existsSync(policyPath)) errors.push("Política de funções ausente.");

const configSource = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const policy = existsSync(policyPath)
  ? JSON.parse(readFileSync(policyPath, "utf8"))
  : { publicFunctions: {}, elevatedFunctions: [], gatewayJwtExceptions: {} };

const publicFunctions = new Set(Object.keys(policy.publicFunctions ?? {}));
const manuallyElevatedFunctions = new Set(
  policy.elevatedFunctions ?? policy.serviceRoleFunctions ?? [],
);
const gatewayJwtExceptions = new Map(
  Object.entries(policy.gatewayJwtExceptions ?? {}),
);
const directories = existsSync(functionsRoot)
  ? readdirSync(functionsRoot).filter((name) => {
      if (name.startsWith("_")) return false;
      return statSync(join(functionsRoot, name)).isDirectory();
    })
  : [];

function readVerifySetting(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = configSource.match(
    new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
  );
  if (!section) return null;
  return section[1].match(/verify_jwt\s*=\s*(true|false)/)?.[1] ?? null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExplicitAuthenticatedUserGuard(source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const resultPattern = /const\s*\{\s*data\s*:\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*,\s*error(?:\s*:\s*([A-Za-z_$][\w$]*))?\s*\}\s*=\s*await[\s\S]{0,180}?\.auth\.getUser\s*\([^;]*\)\s*;/g;

  for (const match of code.matchAll(resultPattern)) {
    const userVariable = match[1];
    const errorVariable = match[2] ?? "error";
    const userCheck = new RegExp(`!\\s*${escapeRegExp(userVariable)}\\b`);
    const errorCheck = new RegExp(`\\b${escapeRegExp(errorVariable)}\\b`);

    for (const condition of code.matchAll(/if\s*\(([^)]*)\)/g)) {
      if (userCheck.test(condition[1]) && errorCheck.test(condition[1])) return true;
    }
  }

  return false;
}

const configuredNames = [...configSource.matchAll(/^\[functions\.([^\]]+)\]/gm)].map((match) => match[1]);

const inventory = directories.map((name) => {
  const indexPath = join(functionsRoot, name, "index.ts");
  const managed = configuredNames.includes(name);
  const verifyJwt = managed ? readVerifySetting(name) : null;
  const isPublic = publicFunctions.has(name);
  const source = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
  const usesAdministrativeClient = source.includes(administrativeKeyName);
  const isElevated = manuallyElevatedFunctions.has(name) || usesAdministrativeClient;
  const validatesAuthenticatedUser = hasExplicitAuthenticatedUserGuard(source);
  const gatewayJwtExceptionReason = gatewayJwtExceptions.get(name) ?? null;
  const hasGatewayJwtException = typeof gatewayJwtExceptionReason === "string" && gatewayJwtExceptionReason.trim().length >= 20;

  if (!existsSync(indexPath)) errors.push(`${name}: index.ts ausente.`);

  if (!managed) {
    warnings.push(`${name}: diretório ainda não possui política explícita em supabase/config.toml.`);
  } else {
    if (verifyJwt === null) errors.push(`${name}: verify_jwt não declarado.`);
    if (isPublic && verifyJwt !== "false") {
      errors.push(`${name}: função pública deve declarar verify_jwt = false.`);
    }
    if (!isPublic && verifyJwt !== "true") {
      if (!hasGatewayJwtException) {
        errors.push(`${name}: função gerenciada privada deve declarar verify_jwt = true ou possuir exceção de gateway documentada.`);
      } else if (!validatesAuthenticatedUser) {
        errors.push(`${name}: exceção de gateway JWT exige guarda explícita com auth.getUser().`);
      }
    }
    if (usesAdministrativeClient && !validatesAuthenticatedUser) {
      errors.push(`${name}: acesso administrativo sem guarda explícita de erro e usuário autenticado.`);
    }
  }

  if (isPublic && isElevated) {
    errors.push(`${name}: uma função pública não pode estar na lista elevada.`);
  }
  if (isPublic && hasGatewayJwtException) {
    errors.push(`${name}: função pública não pode usar exceção de gateway JWT.`);
  }

  return {
    name,
    managed,
    verifyJwt,
    public: isPublic,
    elevated: isElevated,
    elevatedReason: usesAdministrativeClient ? "administrative-client" : manuallyElevatedFunctions.has(name) ? "manual-policy" : null,
    gatewayJwtException: hasGatewayJwtException,
    gatewayJwtExceptionReason: hasGatewayJwtException ? gatewayJwtExceptionReason : null,
    hasExplicitAuthenticatedUserGuard: validatesAuthenticatedUser,
    hasEntryPoint: existsSync(indexPath),
  };
});

for (const name of configuredNames) {
  if (!directories.includes(name)) errors.push(`${name}: configuração sem diretório correspondente.`);
}
for (const name of publicFunctions) {
  if (!directories.includes(name)) errors.push(`${name}: função pública inexistente.`);
  if (!configuredNames.includes(name)) errors.push(`${name}: função pública sem configuração explícita.`);
}
for (const name of manuallyElevatedFunctions) {
  if (!directories.includes(name)) errors.push(`${name}: função elevada inexistente.`);
  if (!configuredNames.includes(name)) errors.push(`${name}: função elevada sem configuração explícita.`);
}
for (const [name, reason] of gatewayJwtExceptions) {
  if (!directories.includes(name)) errors.push(`${name}: exceção de gateway aponta para função inexistente.`);
  if (!configuredNames.includes(name)) errors.push(`${name}: exceção de gateway exige configuração explícita.`);
  if (typeof reason !== "string" || reason.trim().length < 20) {
    errors.push(`${name}: exceção de gateway exige justificativa descritiva.`);
  }
}

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 ? "passed" : "failed",
  summary: {
    functions: inventory.length,
    managedFunctions: inventory.filter((item) => item.managed).length,
    unmanagedFunctions: inventory.filter((item) => !item.managed).length,
    publicFunctions: inventory.filter((item) => item.public).length,
    elevatedFunctions: inventory.filter((item) => item.elevated).length,
    gatewayJwtExceptions: inventory.filter((item) => item.gatewayJwtException).length,
    errors: errors.length,
    warnings: warnings.length,
  },
  inventory,
  errors,
  warnings,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const warning of warnings) console.warn(`AVISO: ${warning}`);
for (const error of errors) console.error(`ERRO: ${error}`);
console.log(
  `Auditoria concluída: ${inventory.length} funções, ${report.summary.managedFunctions} gerenciadas, ${errors.length} erros, ${warnings.length} avisos.`,
);
if (errors.length > 0) process.exit(1);
