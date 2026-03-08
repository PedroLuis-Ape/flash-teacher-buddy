/**
 * Offline Store — IndexedDB-based persistence for offline study.
 *
 * Stores list metadata, flashcards, and favorites per-list.
 * Uses the raw IndexedDB API (no external dependency).
 */

const DB_NAME = "ape-offline";
const DB_VERSION = 1;
const STORE_NAME = "offline_lists";

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
  }>;
  favorites: string[];
  downloadedAt: string;
  version: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "listId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineList(data: OfflineListData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineList(listId: string): Promise<OfflineListData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(listId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineList(listId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(listId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isListAvailableOffline(listId: string): Promise<boolean> {
  const data = await getOfflineList(listId);
  return data !== null;
}

export async function getAllOfflineListIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineStatus(listId: string): Promise<{
  available: boolean;
  lastSync: string | null;
  cardCount: number;
}> {
  const data = await getOfflineList(listId);
  if (!data) return { available: false, lastSync: null, cardCount: 0 };
  return {
    available: true,
    lastSync: data.downloadedAt,
    cardCount: data.flashcards.length,
  };
}
