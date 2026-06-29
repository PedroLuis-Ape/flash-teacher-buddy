import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const runtime = readFileSync("src/integrations/supabase/platformRuntime.ts", "utf8");

if (!/^project_id\s*=\s*"[a-z]{20}"/m.test(config)) process.exit(1);
if (!client.includes("readPlatformRuntime")) process.exit(1);
if (!runtime.includes("import.meta.env.VITE_SUPABASE_URL")) process.exit(1);
if (!runtime.includes("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY")) process.exit(1);
if (runtime.includes("xrnfhhoxmmstagmelvyi")) process.exit(1);

console.log("Platform runtime configuration is valid.");
