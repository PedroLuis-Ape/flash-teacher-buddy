import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
const adapter = readFileSync("src/integrations/supabase/platformBackend.ts", "utf8");

if (!/^project_id\s*=\s*"[a-z]{20}"/m.test(config)) process.exit(1);
if (!client.includes("getPlatformBackend")) process.exit(1);
if (!adapter.includes("return { url, publicValue }")) process.exit(1);

console.log("Platform configuration is valid.");
