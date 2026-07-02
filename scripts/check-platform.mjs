import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const runtime = readFileSync("src/integrations/supabase/platformRuntime.ts", "utf8");
const bootstrap = readFileSync("src/integrations/supabase/runtimeBootstrap.ts", "utf8");

const managedProject = config.match(/^project_id\s*=\s*"([a-z]{20})"/m)?.[1];
const productionDataProject = runtime.match(/PRODUCTION_DATA_PROJECT_ID\s*=\s*"([a-z]{20})"/)?.[1];

if (!managedProject || !productionDataProject) process.exit(1);
if (!client.includes("readPlatformRuntime")) process.exit(1);
if (!runtime.includes(`MANAGED_SUPABASE_PROJECT_ID = "${managedProject}"`)) process.exit(1);
if (!runtime.includes("PRODUCTION_DATA_PUBLIC_VALUE")) process.exit(1);
if (!runtime.includes("PRODUCTION_DATA_RUNTIME")) process.exit(1);
if (!runtime.includes("assertProductionDataRuntime")) process.exit(1);
if (!bootstrap.includes("app-public-config")) process.exit(1);
if (!bootstrap.includes("PRODUCTION_DATA_RUNTIME")) process.exit(1);
if (productionDataProject === managedProject) process.exit(1);

console.log(`Managed project ${managedProject}; production data runtime ${productionDataProject}.`);
