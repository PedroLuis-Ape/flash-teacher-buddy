import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const runtime = readFileSync("src/integrations/supabase/platformRuntime.ts", "utf8");
const bootstrap = readFileSync("src/integrations/supabase/runtimeBootstrap.ts", "utf8");
const main = readFileSync("src/main.tsx", "utf8");

const officialProjectId = config.match(/^project_id\s*=\s*"([a-z]{20})"/m)?.[1];
if (!officialProjectId) process.exit(1);
if (!client.includes("readPlatformRuntime")) process.exit(1);
if (!runtime.includes("__APE_PLATFORM_RUNTIME__")) process.exit(1);
if (runtime.includes("ymahldldyxvwjeruaxpr")) process.exit(1);
if (!bootstrap.includes(`OFFICIAL_SUPABASE_PROJECT_ID = "${officialProjectId}"`)) process.exit(1);
if (!bootstrap.includes("/functions/v1/app-public-config")) process.exit(1);
if (!main.includes("await loadOfficialPlatformRuntime()")) process.exit(1);
if (main.indexOf("await loadOfficialPlatformRuntime()") > main.indexOf('await import("./App.tsx")')) process.exit(1);

console.log(`Runtime configuration is valid for ${officialProjectId}.`);
