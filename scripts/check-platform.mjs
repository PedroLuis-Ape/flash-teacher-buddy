import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const runtime = readFileSync("src/integrations/supabase/platformRuntime.ts", "utf8");
const bootstrap = readFileSync("src/integrations/supabase/runtimeBootstrap.ts", "utf8");
const main = readFileSync("src/main.tsx", "utf8");

const projectId = config.match(/^project_id\s*=\s*"([a-z]{20})"/m)?.[1];
if (!projectId) process.exit(1);
if (!client.includes("readPlatformRuntime")) process.exit(1);
if (!runtime.includes("import.meta.env.VITE_SUPABASE_URL")) process.exit(1);
if (!runtime.includes("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY")) process.exit(1);
if (!runtime.includes("__APE_PLATFORM_RUNTIME__")) process.exit(1);
if (runtime.includes("ymahldldyxvwjeruaxpr")) process.exit(1);
if (!bootstrap.includes(projectId)) process.exit(1);
if (!bootstrap.includes("app-public-config")) process.exit(1);
if (!main.includes("loadOfficialPlatformRuntime")) process.exit(1);

console.log(`Platform runtime configuration is valid for ${projectId}.`);
