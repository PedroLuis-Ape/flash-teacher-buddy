import fs from "node:fs";

const packagePath = "package.json";
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.scripts["store:validate"] = "node scripts/store-packages/validate.mjs";
packageJson.scripts["store:sync"] = "npm run store:validate && node scripts/store-packages/sync.mjs";
if (!packageJson.scripts.check.includes("store:validate")) {
  packageJson.scripts.check = packageJson.scripts.check.replace(
    "npm run typecheck",
    "npm run store:validate && npm run typecheck",
  );
}
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const storePath = "src/lib/storeEngine.ts";
let store = fs.readFileSync(storePath, "utf8");
store = store.replace(
  /\n\/\/ Allowed slugs for store[\s\S]*?\n\];\n/,
  "\n",
);
store = store.replace(
  " * Fetch all available skins from catalog (approved and whitelisted only)",
  " * Fetch all published bundles from the dynamic Supabase catalog",
);
store = store.replace(
  "      .eq('approved', true)\n      .in('slug', ALLOWED_SLUGS)\n      .order('price_pitecoin', { ascending: true });",
  "      .eq('approved', true)\n      .eq('status', 'published')\n      .eq('type', 'bundle')\n      .not('card_final', 'is', null)\n      .neq('card_final', '')\n      .not('avatar_final', 'is', null)\n      .neq('avatar_final', '')\n      .order('price_pitecoin', { ascending: true });",
);
if (store.includes("ALLOWED_SLUGS") || store.includes(".in('slug'")) {
  throw new Error("A whitelist antiga não foi removida completamente.");
}
if (!store.includes(".eq('status', 'published')") || !store.includes(".eq('type', 'bundle')")) {
  throw new Error("Os filtros dinâmicos obrigatórios não foram instalados.");
}
fs.writeFileSync(storePath, store);

const cssPath = "src/index.css";
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* Canonical Piteco store avatar crop */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\nimg[src*="/storage/v1/object/public/piteco-store/"][src*="/avatar.avif"] {\n  object-fit: cover;\n  transform: scale(1.12);\n  transform-origin: center;\n}\n`;
}
fs.writeFileSync(cssPath, css);
