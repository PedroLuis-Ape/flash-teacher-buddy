import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packagesDir = path.join(root, "store-packages");
const catalogPath = path.join(packagesDir, "catalog.json");
const allowedRarities = new Set(["normal", "rare", "epic", "legendary"]);
const errors = [];

function addError(message) {
  errors.push(message);
}

async function readCatalog() {
  try {
    return JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (cause) {
    addError(`Não foi possível ler catalog.json: ${cause instanceof Error ? cause.message : String(cause)}`);
    return null;
  }
}

function isAvif(bytes) {
  if (bytes.length < 12) return false;
  const box = bytes.subarray(4, 12).toString("ascii");
  return box === "ftypavif" || box === "ftypavis";
}

function isPng(bytes) {
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

async function validateAsset(id, basename) {
  const candidates = [
    { extension: "avif", validate: isAvif },
    { extension: "png", validate: isPng },
  ];
  const found = [];

  for (const candidate of candidates) {
    const filename = path.join(packagesDir, id, `${basename}.${candidate.extension}`);
    try {
      const metadata = await stat(filename);
      if (!metadata.isFile() || metadata.size === 0) {
        addError(`[${id}] ${basename}.${candidate.extension} está vazio ou não é arquivo.`);
        continue;
      }
      const bytes = await readFile(filename);
      if (!candidate.validate(bytes)) {
        addError(`[${id}] ${basename}.${candidate.extension} possui conteúdo inválido.`);
        continue;
      }
      found.push(candidate.extension);
    } catch {
      // Outro formato permitido pode existir.
    }
  }

  if (found.length === 0) addError(`[${id}] ${basename}.png ou ${basename}.avif obrigatório ausente.`);
  if (found.length > 1) addError(`[${id}] mantenha apenas um formato para ${basename}: PNG ou AVIF.`);
}

const catalog = await readCatalog();
if (catalog) {
  if (catalog.schema !== "app-piteco-store-catalog") addError("catalog.json possui schema inválido.");
  if (catalog.version !== 1) addError("catalog.json deve usar version 1.");

  if (!Array.isArray(catalog.packages)) {
    addError("catalog.json deve conter packages como array.");
  } else {
    const ids = new Set();
    const names = new Set();

    for (const item of catalog.packages) {
      const id = typeof item?.id === "string" ? item.id : "";
      const label = `[${id || "sem_id"}]`;
      if (!/^[a-z0-9_]+$/.test(id)) addError(`${label} ID inválido; use apenas letras minúsculas, números e underscore.`);
      if (ids.has(id)) addError(`${label} ID duplicado.`);
      ids.add(id);
      if (typeof item?.name !== "string" || !item.name.trim()) addError(`${label} nome ausente.`);
      if (names.has(item?.name)) addError(`${label} nome duplicado.`);
      names.add(item?.name);
      if (typeof item?.description !== "string" || !item.description.trim()) addError(`${label} descrição ausente.`);
      if (!allowedRarities.has(item?.rarity)) addError(`${label} raridade inválida.`);
      if (!Number.isInteger(item?.price_pitecoin) || item.price_pitecoin < 0) addError(`${label} preço inválido.`);
      if (typeof item?.active !== "boolean") addError(`${label} active deve ser booleano.`);
      if (!Number.isInteger(item?.version) || item.version < 1) addError(`${label} version deve ser inteiro positivo.`);

      if (item?.active === true && id) {
        await validateAsset(id, "card");
        await validateAsset(id, "avatar");
      }
    }

    try {
      const entries = await readdir(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !ids.has(entry.name)) {
          addError(`[${entry.name}] pasta órfã: não existe entrada correspondente em catalog.json.`);
        }
      }
    } catch (cause) {
      addError(`Não foi possível listar store-packages: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
}

if (errors.length > 0) {
  console.error("\nFalha na validação da loja:\n" + errors.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

const activeCount = catalog.packages.filter((item) => item.active).length;
console.log(`Catálogo válido: ${catalog.packages.length} pacote(s), ${activeCount} ativo(s).`);
