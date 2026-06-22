import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "store-packages");
const catalogPath = path.join(sourceDir, "catalog-v1.json");
const metadataOnly = process.argv.includes("--metadata-only");
const allowedRarities = new Set(["normal", "rare", "epic", "legendary"]);

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

if (catalog.version !== 1 || !Array.isArray(catalog.packages)) {
  throw new Error("store-packages/catalog-v1.json possui formato inválido.");
}

const ids = new Set();
const errors = [];
const warnings = [];

async function findAsset(packageDir, basename) {
  const candidates = [
    `${basename}.avif`,
    `${basename}.webp`,
    `${basename}.png`,
    `${basename}.jpg`,
    `${basename}.jpeg`,
    `${basename}.avif.b64`,
    `${basename}.webp.b64`,
    `${basename}.png.b64`,
    `${basename}.jpg.b64`,
  ];

  for (const filename of candidates) {
    const filepath = path.join(packageDir, filename);
    try {
      await access(filepath);
      const info = await stat(filepath);
      if (info.size > 0) return filepath;
    } catch {
      // Try the next supported extension.
    }
  }

  return null;
}

for (const item of catalog.packages) {
  const prefix = item?.id ? `[${item.id}]` : "[pacote sem id]";

  if (!item || typeof item !== "object") {
    errors.push("Existe uma entrada de pacote inválida.");
    continue;
  }

  if (!/^[a-z0-9_]+$/.test(item.id || "")) {
    errors.push(`${prefix} id deve usar apenas letras minúsculas, números e underscore.`);
  }

  if (ids.has(item.id)) errors.push(`${prefix} id duplicado.`);
  ids.add(item.id);

  if (!item.name || typeof item.name !== "string") errors.push(`${prefix} nome ausente.`);
  if (!allowedRarities.has(item.rarity)) errors.push(`${prefix} raridade inválida.`);
  if (!Number.isInteger(item.price) || item.price < 0) errors.push(`${prefix} preço inválido.`);

  const active = item.active !== false;
  if (!active || metadataOnly) continue;

  const packageDir = path.join(sourceDir, item.id);
  const card = await findAsset(packageDir, "card");
  const avatar = await findAsset(packageDir, "avatar");

  if (!card) errors.push(`${prefix} card obrigatório não encontrado.`);
  if (!avatar) errors.push(`${prefix} avatar obrigatório não encontrado.`);

  if (card && avatar) {
    warnings.push(`${prefix} conjunto completo: card + avatar.`);
  }
}

for (const message of warnings) console.log(`✓ ${message}`);

if (errors.length) {
  console.error("\nFalha na validação dos pacotes:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\nCatálogo válido: ${catalog.packages.length} pacote(s).`);
