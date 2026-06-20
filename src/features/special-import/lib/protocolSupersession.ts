import {
  loadSpecialExportManifests,
  type SpecialExportPackage,
  type StoredSpecialExportManifest,
} from "./protocolPolicy";

const MANIFEST_STORAGE_KEY = "ape:special-export-manifests:v2";
const MAX_MANIFEST_BYTES = 2_500_000;
const MAX_MANIFESTS = 20;

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveSpecialExportManifest(
  batch: SpecialExportPackage,
  storage: Storage | null = browserStorage(),
): StoredSpecialExportManifest | null {
  if (!storage) return null;

  const manifest: StoredSpecialExportManifest = {
    ...batch,
    created_at: new Date().toISOString(),
    status: "awaiting_import",
  };
  const supersededIds = new Set(batch.cards.map((card) => card.flashcard_id));
  const previous = loadSpecialExportManifests(storage)
    .filter((item) => item.export_id !== batch.export_id)
    .map((item): StoredSpecialExportManifest => {
      const cards = item.cards.filter((card) => !supersededIds.has(card.flashcard_id));
      return {
        ...item,
        cards,
        card_count: cards.length,
        status: cards.length === 0 ? "completed" : item.status,
      };
    });

  const next = [manifest, ...previous].slice(0, MAX_MANIFESTS);
  while (next.length > 1 && JSON.stringify(next).length > MAX_MANIFEST_BYTES) {
    next.pop();
  }

  try {
    storage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(next));
    return manifest;
  } catch {
    return null;
  }
}
