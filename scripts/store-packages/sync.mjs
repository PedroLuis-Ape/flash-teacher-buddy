import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const catalog = JSON.parse(
  await readFile(path.join(root, "store-packages", "catalog.json"), "utf8"),
);
const dryRun = process.argv.includes("--dry-run");
const onlyArgument = process.argv.find(argument => argument.startsWith("--only="));
const onlyId = onlyArgument?.slice("--only=".length) || null;
const selectedPackages = onlyId
  ? catalog.packages.filter(item => item.id === onlyId)
  : catalog.packages;

if (onlyId && selectedPackages.length === 0) {
  throw new Error(`Pacote não encontrado: ${onlyId}`);
}

for (const item of selectedPackages) {
  console.log(`${item.active ? "PUBLICAR" : "ARQUIVAR"}: ${item.id} v${item.version}`);
}

if (dryRun) {
  console.log("Planejamento concluído. Nenhuma alteração foi realizada.");
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mimeTypes = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function ensureBucket() {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw error;
  if (data.some(bucket => bucket.id === catalog.bucket)) return;

  const { error: createError } = await admin.storage.createBucket(catalog.bucket, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: Object.values(mimeTypes),
  });
  if (createError) throw createError;
}

async function uploadAsset(item, kind) {
  const filename = item.assets[kind];
  const assetPath = path.resolve(root, "store-packages", item.id, filename);
  const bytes = await readFile(assetPath);
  const extension = path.extname(assetPath).toLowerCase();
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const objectPath = `${item.id}/${kind}-${hash}${extension}`;

  const { error } = await admin.storage.from(catalog.bucket).upload(objectPath, bytes, {
    cacheControl: "31536000",
    contentType: mimeTypes[extension],
    upsert: true,
  });
  if (error) throw error;

  const publicUrl = admin.storage.from(catalog.bucket).getPublicUrl(objectPath).data.publicUrl;
  return { publicUrl, hash };
}

async function archivePackage(item) {
  const archived = {
    is_active: false,
    approved: false,
    status: "archived",
    updated_at: new Date().toISOString(),
  };

  const [{ error: sourceError }, { error: publicError }] = await Promise.all([
    admin.from("skins_catalog").update(archived).eq("id", item.id),
    admin.from("public_catalog").update(archived).eq("id", item.id),
  ]);
  if (sourceError) throw sourceError;
  if (publicError) throw publicError;

  const { error: logError } = await admin.from("store_package_sync_log").insert({
    package_id: item.id,
    action: "archive",
    version: item.version,
    asset_hashes: {},
    source: "store-packages",
  });
  if (logError) throw logError;
}

async function publishPackage(item) {
  const [avatar, card] = await Promise.all([
    uploadAsset(item, "avatar"),
    uploadAsset(item, "card"),
  ]);
  const now = new Date().toISOString();
  const common = {
    id: item.id,
    sku: item.id.toUpperCase(),
    slug: item.slug,
    name: item.name,
    description: item.description,
    rarity: item.rarity,
    type: "bundle",
    price_pitecoin: item.price_pitecoin,
    avatar_original: avatar.publicUrl,
    card_original: card.publicUrl,
    avatar_final: avatar.publicUrl,
    card_final: card.publicUrl,
    is_active: true,
    approved: true,
    status: "published",
    version: item.version,
    updated_at: now,
  };

  const sourceRow = {
    ...common,
    avatar_src: avatar.publicUrl,
    card_src: card.publicUrl,
    avatar_img: avatar.publicUrl,
    card_img: card.publicUrl,
  };

  const [{ error: sourceError }, { error: publicError }] = await Promise.all([
    admin.from("skins_catalog").upsert(sourceRow, { onConflict: "id" }),
    admin.from("public_catalog").upsert(common, { onConflict: "id" }),
  ]);
  if (sourceError) throw sourceError;
  if (publicError) throw publicError;

  const { error: logError } = await admin.from("store_package_sync_log").insert({
    package_id: item.id,
    action: "publish",
    version: item.version,
    asset_hashes: { avatar: avatar.hash, card: card.hash },
    source: "store-packages",
  });
  if (logError) throw logError;
}

await ensureBucket();
for (const item of selectedPackages) {
  if (item.active) await publishPackage(item);
  else await archivePackage(item);
}

console.log(`Sincronização concluída: ${selectedPackages.length} pacote(s).`);
