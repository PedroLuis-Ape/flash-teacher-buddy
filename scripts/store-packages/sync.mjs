import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "xrnfhhoxmmstagmelvyi";
const root = process.cwd();
const packagesDir = path.join(root, "store-packages");
const catalog = JSON.parse(await readFile(path.join(packagesDir, "catalog.json"), "utf8"));
const dryRun = process.argv.includes("--dry-run");
const allowNonProduction = process.argv.includes("--allow-non-production");
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORE_BUCKET || "piteco-store";

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

if (supabaseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  if (!allowNonProduction && projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error(`Projeto Supabase recusado: ${projectRef}. Esperado: ${PRODUCTION_PROJECT_REF}.`);
  }
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function loadAsset(id, basename) {
  const filename = path.join(packagesDir, id, `${basename}.avif`);
  const bytes = await readFile(filename);
  return {
    bytes,
    objectPath: `${id}/${basename}.avif`,
    digest: sha256(bytes).slice(0, 16),
  };
}

async function ensureBucket() {
  if (!supabase || dryRun) return;
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error && !String(error.message).toLowerCase().includes("not found")) throw error;

  const options = {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/avif"],
  };

  if (data) {
    const { error: updateError } = await supabase.storage.updateBucket(bucket, options);
    if (updateError) throw updateError;
  } else {
    const { error: createError } = await supabase.storage.createBucket(bucket, options);
    if (createError) throw createError;
  }
}

async function uploadAsset(asset) {
  if (dryRun) {
    return `https://${PRODUCTION_PROJECT_REF}.supabase.co/storage/v1/object/public/${bucket}/${asset.objectPath}?v=${asset.digest}`;
  }
  const { error } = await supabase.storage.from(bucket).upload(asset.objectPath, asset.bytes, {
    contentType: "image/avif",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(asset.objectPath);
  return `${data.publicUrl}?v=${asset.digest}`;
}

async function removeSupersededAssets(packageId) {
  if (!supabase || dryRun) return;
  const { data, error } = await supabase.storage.from(bucket).list(packageId, { limit: 1000 });
  if (error) throw error;
  const stale = (data || [])
    .filter((entry) => entry.id && entry.name !== "avatar.avif" && entry.name !== "card.avif")
    .map((entry) => `${packageId}/${entry.name}`);
  if (stale.length > 0) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(stale);
    if (removeError) throw removeError;
  }
}

async function upsertPublishedPackage(item, avatarUrl, cardUrl) {
  const now = new Date().toISOString();
  const common = {
    id: item.id,
    sku: item.sku || `${item.id.toUpperCase()}_BUNDLE_V1`,
    slug: item.id,
    name: item.name,
    description: item.description,
    rarity: item.rarity,
    type: "bundle",
    price_pitecoin: item.price_pitecoin,
    avatar_original: avatarUrl,
    card_original: cardUrl,
    avatar_final: avatarUrl,
    card_final: cardUrl,
    is_active: true,
    approved: true,
    status: "published",
    version: item.version,
    updated_at: now,
  };

  if (dryRun) return;

  const sourceRow = {
    ...common,
    avatar_src: avatarUrl,
    card_src: cardUrl,
    avatar_img: avatarUrl,
    card_img: cardUrl,
  };

  const { error: sourceError } = await supabase
    .from("skins_catalog")
    .upsert(sourceRow, { onConflict: "id" });
  if (sourceError) throw sourceError;

  const { error: publicError } = await supabase
    .from("public_catalog")
    .upsert(common, { onConflict: "id" });
  if (publicError) throw publicError;
}

async function archivePackage(table, id) {
  if (dryRun) return;
  const { error } = await supabase
    .from(table)
    .update({
      is_active: false,
      approved: false,
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

async function archiveMissingPackages(activeIds) {
  if (!supabase || dryRun) return;
  for (const table of ["skins_catalog", "public_catalog"]) {
    const { data, error } = await supabase.from(table).select("id, slug");
    if (error) throw error;
    const obsoleteIds = (data || [])
      .filter((row) => {
        const id = String(row.id || "");
        const slug = String(row.slug || "");
        return (id.startsWith("piteco_") || slug.startsWith("piteco_")) && !activeIds.has(id);
      })
      .map((row) => row.id);

    for (const id of obsoleteIds) {
      await archivePackage(table, id);
      console.log(`Arquivado em ${table}: ${id}`);
    }
  }
}

await ensureBucket();
const activeIds = new Set();

for (const item of catalog.packages) {
  if (!item.active) {
    console.log(`${dryRun ? "[simulação] " : ""}Arquivando ${item.name}`);
    await archivePackage("skins_catalog", item.id);
    await archivePackage("public_catalog", item.id);
    continue;
  }

  activeIds.add(item.id);
  const avatar = await loadAsset(item.id, "avatar");
  const card = await loadAsset(item.id, "card");
  const avatarUrl = await uploadAsset(avatar);
  const cardUrl = await uploadAsset(card);

  console.log(`${dryRun ? "[simulação] " : ""}Publicando ${item.name}`);
  console.log(`  avatar: ${avatarUrl}`);
  console.log(`  card:   ${cardUrl}`);

  await upsertPublishedPackage(item, avatarUrl, cardUrl);
  await removeSupersededAssets(item.id);
}

await archiveMissingPackages(activeIds);
console.log(`Sincronização concluída: ${activeIds.size} pacote(s) publicado(s).`);
