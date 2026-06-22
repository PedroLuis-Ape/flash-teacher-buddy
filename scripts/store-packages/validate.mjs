import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packagesDir = path.join(root, "store-packages");
const catalogPath = path.join(packagesDir, "catalog.json");
const allowedRarities = new Set(["normal", "rare", "epic", "legendary"]);
const errors = [];

function error(message) {
  errors.push(message);
}

async function readCatalog() {
  try {
    return JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (cause) {
    error(`Não foi possível ler catalog.json: ${cause instanceof Error ? cause.message : String(cause)}`);
    return null;
  }
}

function isAvif(bytes) {
  if (bytes.length < 12) return false;
  const box = bytes.subarray(4, 12).toString("ascii");
  return box === "ftypavif" || box === "ftypavis";
}

async function validateAsset(id, basename) {
  const filename = path.join(packagesDir, id, `${basename}.avif`);
  try {
    const metadata = await stat(filename);
    if (!metadata.isFile() || metadata.size === 0) {
      error(`[${id}] ${basename}.avif está vazio ou não é arquivo.`);
      return;
    }
    const bytes = await readFile(filename);
    if (!isAvif(bytes)) {
      error(`[${id}] ${basename}.avif não contém um arquivo AVIF válido.`);
    }
  } catch {
    error(`[${id}] ${basename}.avif obrigatório ausente.`);
  }
}

const catalog = await readCatalog();
if (catalog) {
  if (catalog.schema !== "app-piteco-store-catalog") {
    error("catalog.json possui schema inválido.");
  }
  if (catalog.version !== 1) {
    error("catalog.json deve usar version 1.");
  }
  if (!Array.isArray(catalog.packages)) {
    error("catalog.json deve conter packages como array.");
  } else {
    const ids = new Set();
    const names = new Set();

    for (const item of catalog.packages) {
      const id = typeof item?.id === "string" ? item.id : "";
      const label = `[${id || "sem_id"}]`;

      if (!/^[a-z0-9_]+$/.test(id)) error(`${label} ID inválido; use apenas letras minúsculas, números e underscore.`);
      if (ids.has(id)) error(`${label} ID duplicado.`);
      ids.add(id);

      if (typeof item?.name !== "string" || !item.name.trim()) error(`${label} nome ausente.`);
      if (names.has(item?.name)) error(`${label} nome duplicado.`);
      names.add(item?.name);

      if (typeof item?.description !== "string" || !item.description.trim()) error(`${label} descrição ausente.`);
      if (!allowedRarities.has(item?.rarity)) error(`${label} raridade inválida.`);
      if (!Number.isInteger(item?.price_pitecoin) || item.price_pitecoin < 0) error(`${label} preço inválido.`);
      if (typeof item?.active !== "boolean") error(`${label} active deve ser booleano.`);
      if (!Number.isInteger(item?.version) || item.version < 1) error(`${label} version deve ser inteiro positivo.`);

      if (item?.active === true && id) {
        await validateAsset(id, "card");
        await validateAsset(id, "avatar");
      }
    }

    try {
      const entries = await readdir(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !ids.has(entry.name)) {
          error(`[${entry.name}] pasta órfã: não existe entrada correspondente em catalog.json.`);
        }
      }
    } catch (cause) {
      error(`Não foi possível listar store-packages: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
}

if (errors.length > 0) {
  console.error("\nFalha na validação da loja:\n" + errors.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

const activeCount = catalog.packages.filter((item) => item.active).length;
console.log(`Catálogo válido: ${catalog.packages.length} pacote(s), ${activeCount} ativo(s).`);
