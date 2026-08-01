/**
 * Offline Store — IndexedDB-based persistence for offline study.
 *
 * Stores list metadata, flashcards, and favorites per-list.
 * Uses the raw IndexedDB API (no external dependency).
 *
 * Schema versions:
 *   v1 — original schema (single store `offline_lists`, keyPath=listId).
 *   v2 — adds per-record `schemaVersion` and `userId` fields, and
 *        `status_group_uid` on each flashcard. Old records are kept in place
 *        and lazily migrated on read (`migrateRecord`). No data loss.
 */

const DB_NAME = "ape-offline";
const DB_VERSION = 3;
const STORE_NAME = "offline_lists";
const V3_STORE_NAME = "offline_lists_v3";
export const OFFLINE_SCHEMA_VERSION = 3;

export interface OfflineListData {
  listId: string;
  listMeta: {
    title: string;
    lang_a: string;
    lang_b: string;
    labels_a: string;
    labels_b: string;
    study_type: string;
    tts_enabled: boolean;
    folder_id?: string;
  };
  flashcards: Array<{
    id: string;
    term: string;
    translation: string;
    hint?: string | null;
    accepted_answers_en?: string[] | null;
    accepted_answers_pt?: string[] | null;
    image_url_a?: string | null;
    image_url_b?: string | null;
    word_hints?: unknown;
    /** Phase 6 — stable group identity. Null for v1 snapshots. */
    status_group_uid?: string | null;
    /** Phase 6 — preserved so the engine can rebuild the canonical map. */
    parent_card_id?: string | null;
    layer_index?: number | null;
  }>;
  favorites: string[];
  downloadedAt: string;
  version: number;
  /** Phase 6 — schema version stamped at write time. */
  schemaVersion?: number;
  /** Phase 6 — owner of the snapshot. Used to refuse cross-user reads. */
  userId?: string | null;
  storageKey?: string;
}

export function buildOfflineStorageKey(userId: string, listId: string): string {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(listId)}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "listId" });
      }
      if (!db.objectStoreNames.contains(V3_STORE_NAME)) {
        db.createObjectStore(V3_STORE_NAME, { keyPath: "storageKey" });
      }
      // v1 → v2: nothing to do structurally. New fields are optional and
      // back-filled lazily by migrateRecord on first read after upgrade.
      void event;
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lazy v1 → v2 migration applied at read time. Pure (no IO), so the caller
 * can decide whether to persist the upgraded record.
 */
export function migrateRecord(rec: OfflineListData | null): OfflineListData | null {
  if (!rec) return rec;
  if (rec.schemaVersion === OFFLINE_SCHEMA_VERSION) return rec;
  return {
    ...rec,
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    userId: rec.userId ?? null,
    flashcards: rec.flashcards.map((f) => ({
      ...f,
      // Pre-v2 snapshots did not carry status_group_uid. The safest default
      // is `id` (which equals COALESCE(parent_card_id, id) for non-layered
      // cards — see Phase 2 backfill). Layered v1 snapshots will be re-
      // synced from the server on the next download; we never invent a
      // group identity for a layer we cannot prove.
      status_group_uid:
        f.status_group_uid ?? (f.parent_card_id ? null : f.id),
      parent_card_id: f.parent_card_id ?? null,
      layer_index: f.layer_index ?? null,
    })),
  };
}

export async function saveOfflineList(data: OfflineListData): Promise<void> {
  if (!data.userId) {
    throw new Error("Uma conta autenticada é necessária para salvar uma lista offline");
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(V3_STORE_NAME, "readwrite");
    tx.objectStore(V3_STORE_NAME).put({
      ...data,
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      storageKey: buildOfflineStorageKey(data.userId, data.listId),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineList(listId: string, userId?: string | null): Promise<OfflineListData | null> {
  if (!userId) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(V3_STORE_NAME, "readonly");
    const req = tx.objectStore(V3_STORE_NAME).get(buildOfflineStorageKey(userId, listId));
    req.onsuccess = () => resolve(migrateRecord(req.result ?? null));
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineList(listId: string, userId?: string | null): Promise<void> {
  if (!userId) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(V3_STORE_NAME, "readwrite");
    tx.objectStore(V3_STORE_NAME).delete(buildOfflineStorageKey(userId, listId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isListAvailableOffline(listId: string, userId?: string | null): Promise<boolean> {
  const data = await getOfflineList(listId, userId);
  return data !== null;
}

export async function getAllOfflineListIds(userId?: string | null): Promise<string[]> {
  if (!userId) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(V3_STORE_NAME, "readonly");
    const req = tx.objectStore(V3_STORE_NAME).getAll();
    req.onsuccess = () => resolve(
      ((req.result as OfflineListData[]) ?? [])
        .filter((item) => item.userId === userId)
        .map((item) => item.listId),
    );
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineStatus(listId: string, userId?: string | null): Promise<{
  available: boolean;
  lastSync: string | null;
  cardCount: number;
}> {
  const data = await getOfflineList(listId, userId);
  if (!data) return { available: false, lastSync: null, cardCount: 0 };
  return {
    available: true,
    lastSync: data.downloadedAt,
    cardCount: data.flashcards.length,
  };
}
