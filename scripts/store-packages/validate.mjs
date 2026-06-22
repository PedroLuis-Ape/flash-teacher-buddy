import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "store-packages", "catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const requireAssets = process.argv.includes("--require-assets");
const rarities = new Set(["normal", "rare", "epic", "legendary"]);
const extensions = new Set([".avif", ".webp", ".png", ".jpg", ".jpeg"]);
const errors = [];
const warnings = [];
const ids = new Set();
const slugs = new Set();

if (catalog.schema !== "app-piteco-store-catalog") errors.push("Schema inválido.");
if (catalog.version !== 1) errors.push("Versão inválida.");
if (!Array.isArray(catalog.packages)) errors.push("packages deve ser uma lista.");

async function validateAsset(item, kind) {
  const filename = item.assets?.[kind];
  if (typeof filename !== "string" || !filename) {
    errors.push(`[${item.id}] ${kind} não informado.`);
    return;
  }

  const packageDir = path.resolve(root, "store-packages", item.id);
  const assetPath = path.resolve(packageDir, filename);
  if (!assetPath.startsWith(`${packageDir}${path.sep}`)) {
    errors.push(`[${item.id}] caminho de ${kind} inválido.`);
    return;
  }

  if (!extensions.has(path.extname(assetPath).toLowerCase())) {
    errors.push(`[${item.id}] formato de ${kind} não aceito.`);
    return;
  }

  try {
    const info = await stat(assetPath);
    if (!info.isFile() || info.size === 0) errors.push(`[${item.id}] ${kind} inválido.`);
    if (info.size > 8 * 1024 * 1024) errors.push(`[${item.id}] ${kind} ultrapassa 8 MB.`);
  } catch {
    errors.push(`[${item.id}] ${kind} não encontrado.`);
  }
}

for (const item of catalog.packages || []) {
  const prefix = `[${item.id || "sem_id"}]`;
  if (!/^[a-z0-9_]+$/.test(item.id || "")) errors.push(`${prefix} id inválido.`);
  if (!/^[a-z0-9_]+$/.test(item.slug || "")) errors.push(`${prefix} slug inválido.`);
  if (ids.has(item.id)) errors.push(`${prefix} id duplicado.`);
  if (slugs.has(item.slug)) errors.push(`${prefix} slug duplicado.`);
  ids.add(item.id);
  slugs.add(item.slug);
  if (!item.name) errors.push(`${prefix} nome ausente.`);
  if (!item.description) errors.push(`${prefix} descrição ausente.`);
  if (!rarities.has(item.rarity)) errors.push(`${prefix} raridade inválida.`);
  if (!Number.isInteger(item.price_pitecoin) || item.price_pitecoin < 0) errors.push(`${prefix} preço inválido.`);
  if (typeof item.active !== "boolean") errors.push(`${prefix} active inválido.`);
  if (!Number.isInteger(item.version) || item.version < 1) errors.push(`${prefix} versão inválida.`);

  if (requireAssets || item.active) {
    await validateAsset(item, "card");
    await validateAsset(item, "avatar");
  } else {
    warnings.push(`${prefix} permanece como rascunho.`);
  }
}

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERRO: ${error}`);
  process.exit(1);
}

console.log(`Catálogo válido: ${(catalog.packages || []).length} pacote(s).`);
