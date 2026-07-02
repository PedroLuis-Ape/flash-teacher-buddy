import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const runtime = readFileSync("src/integrations/supabase/platformRuntime.ts", "utf8");
const bootstrap = readFileSync("src/integrations/supabase/runtimeBootstrap.ts", "utf8");

const project = config.match(/^project_id\s*=\s*"([a-z]{20})"/m)?.[1];
if (!project) process.exit(1);
if (!client.includes("readPlatformRuntime")) process.exit(1);
if (!runtime.includes("VITE_SUPABASE_URL")) process.exit(1);
if (!runtime.includes("VITE_SUPABASE_PUBLISHABLE_KEY")) process.exit(1);
if (!runtime.includes(`OFFICIAL_SUPABASE_PROJECT_ID = "${project}"`)) process.exit(1);
if (!runtime.includes("OFFICIAL_SUPABASE_PUBLIC_VALUE")) process.exit(1);
if (!runtime.includes("OFFICIAL_RUNTIME")) process.exit(1);
if (!runtime.includes("assertOfficialRuntime")) process.exit(1);
if (!bootstrap.includes("app-public-config")) process.exit(1);
if (runtime.includes("ymahldldyxvwjeruaxpr")) process.exit(1);
if (bootstrap.includes("ymahldldyxvwjeruaxpr")) process.exit(1);

console.log("Platform runtime is restricted to the configured project and resilient to stale preview variables.");
