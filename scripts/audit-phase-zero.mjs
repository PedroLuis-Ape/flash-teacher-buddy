import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, relative, resolve } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outputPath = outIndex >= 0 ? args[outIndex + 1] : null;

function read(relativePath) {
  const absolutePath = resolve(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function walk(relativeDir) {
  const absoluteDir = resolve(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];

  const files = [];
  for (const entry of readdirSync(absoluteDir)) {
    if (["node_modules", ".git", "dist", "coverage"].includes(entry)) continue;
    const absoluteEntry = resolve(absoluteDir, entry);
    const relativeEntry = relative(root, absoluteEntry).replaceAll("\\", "/");
    if (statSync(absoluteEntry).isDirectory()) files.push(...walk(relativeEntry));
    else files.push(relativeEntry);
  }
  return files;
}

function parseEnvKeys(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .sort();
}

function envValue(source, key) {
  const line = source
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${key}=`));
  if (!line) return null;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

function scanFiles(files, pattern) {
  const hits = [];
  for (const file of files) {
    const source = read(file);
    if (!source) continue;
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) hits.push({ file, line: index + 1 });
      pattern.lastIndex = 0;
    });
  }
  return hits;
}

const sourceFiles = walk("src").filter((file) =>
  [".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(extname(file)),
);
const envSource = read(".env");
const configSource = read("supabase/config.toml");
const appSource = read("src/App.tsx");
const flagsSource = read("src/lib/featureFlags.ts");

const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .sort();

const featureFlagBlock = flagsSource.match(
  /export const FEATURE_FLAGS\s*=\s*\{([\s\S]*?)\}\s*as const;/,
)?.[1] ?? "";
const featureFlags = [...featureFlagBlock.matchAll(/^\s{2}([a-zA-Z0-9_]+):/gm)]
  .map((match) => match[1])
  .sort();

const migrationFiles = walk("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort();
const edgeFunctions = readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const workflows = walk(".github/workflows")
  .filter((file) => [".yml", ".yaml"].includes(extname(file)))
  .sort();

const envProjectId = envValue(envSource, "VITE_SUPABASE_PROJECT_ID");
const configProjectId = configSource.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? null;

const report = {
  generatedAt: new Date().toISOString(),
  repository: "PedroLuis-Ape/flash-teacher-buddy",
  routes: { count: routes.length, values: routes },
  featureFlags: { count: featureFlags.length, values: featureFlags },
  environment: {
    versionedEnvPresent: Boolean(envSource),
    envKeys: parseEnvKeys(envSource),
    envProjectId,
    configProjectId,
    projectRefsMatch: Boolean(envProjectId && envProjectId === configProjectId),
  },
  temporaryGates: {
    ownerEmail: scanFiles(sourceFiles, /VITE_OWNER_EMAIL/g),
    localStorage: scanFiles(sourceFiles, /localStorage/g),
    sessionStorage: scanFiles(sourceFiles, /sessionStorage/g),
  },
  migrations: {
    count: migrationFiles.length,
    first: migrationFiles.slice(0, 5),
    latest: migrationFiles.slice(-10),
  },
  edgeFunctions,
  workflows,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  writeFileSync(resolve(root, outputPath), serialized, "utf8");
  console.log(`Inventário da Fase 0 salvo em ${outputPath}.`);
} else {
  process.stdout.write(serialized);
}
