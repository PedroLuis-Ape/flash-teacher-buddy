import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const runtime = readFileSync("src/integrations/supabase/platformRuntime.ts", "utf8");
const bootstrap = readFileSync("src/integrations/supabase/runtimeBootstrap.ts", "utf8");
const main = readFileSync("src/main.tsx", "utf8");

const configProject = config.match(/^project_id\s*=\s*"([a-z]{20})"/m)?.[1];
const runtimeProject = runtime.match(/OFFICIAL_SUPABASE_PROJECT_ID\s*=\s*"([a-z]{20})"/)?.[1];

if (!configProject || !runtimeProject || configProject !== runtimeProject) process.exit(1);
if (!client.includes("readPlatformRuntime")) process.exit(1);
if (!runtime.includes("assertOfficialPlatformRuntime")) process.exit(1);
if (!runtime.includes("__APE_PLATFORM_RUNTIME__")) process.exit(1);
if (runtime.includes("PRODUCTION_DATA_PROJECT_ID")) process.exit(1);
if (!bootstrap.includes("app-public-config")) process.exit(1);
if (!bootstrap.includes("fetchImpl(OFFICIAL_RUNTIME_ENDPOINT")) process.exit(1);
if (!main.includes("installPlatformRuntime(await loadOfficialPlatformRuntime())")) process.exit(1);
if (main.indexOf("installPlatformRuntime(await loadOfficialPlatformRuntime())") > main.indexOf('import("./App.tsx")')) process.exit(1);

console.log(`Official Supabase project: ${configProject}.`);
