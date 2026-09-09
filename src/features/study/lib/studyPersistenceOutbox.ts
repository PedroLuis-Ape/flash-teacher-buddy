/**
 * Durable write-ahead log for study sessions and answer events.
 *
 * localStorage remains the synchronous snapshot fallback. This store is the
 * retry boundary: a tab can be closed, suspended, or go offline after the
 * UI has changed and the next authenticated session can still converge with
 * the server. Session snapshots are coalesced by session identity; answer
 * events are never coalesced because each operation is meaningful.
 */

const DB_NAME = "ape-study-persistence";
const DB_VERSION = 1;
const SESSION_STORE = "session_snapshots";
const PROGRESS_STORE = "progress_events";

export type StudyOutboxState = "pending" | "failed";

export interface StudySessionOutboxRecord {
  key: string;
  userId: string;
  sessionId: string;
  listId: string;
  mode: string;
  sessionScopeKey: string;
  revision: number;
  payload: Record<string, unknown>;
  updatedAt: number;
  state: StudyOutboxState;
  attempts: number;
  lastError?: string | null;
}

export interface StudyProgressOutboxRecord {
  operationId: string;
  userId: string;
  flashcardId: string;
  listId: string;
  correct: boolean;
  createdAt: number;
  updatedAt: number;
  state: StudyOutboxState;
  attempts: number;
  lastError?: string | null;
}

function isBrowser(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const sessions = db.createObjectStore(SESSION_STORE, { keyPath: "key" });
        sessions.createIndex("by_user", "userId", { unique: false });
        sessions.createIndex("by_user_updated", ["userId", "updatedAt"], { unique: false });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        const progress = db.createObjectStore(PROGRESS_STORE, { keyPath: "operationId" });
        progress.createIndex("by_user", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function putRecord<T extends object>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function enqueueStudySessionSnapshot(
  input: Omit<StudySessionOutboxRecord, "state" | "attempts" | "lastError">,
): Promise<boolean> {
  const db = await openDB();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const store = tx.objectStore(SESSION_STORE);
    let accepted = true;
    const read = store.get(input.key);
    read.onsuccess = () => {
      const existing = read.result as StudySessionOutboxRecord | undefined;
      if (existing && existing.revision > input.revision) {
        accepted = false;
        return;
      }
      store.put({
        ...input,
        state: "pending",
        attempts: existing?.attempts ?? 0,
        lastError: null,
      } satisfies StudySessionOutboxRecord);
    };
    read.onerror = () => reject(read.error);
    tx.oncomplete = () => resolve(accepted);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listPendingStudySessionSnapshots(userId: string): Promise<StudySessionOutboxRecord[]> {
  const records = await getAllRecords<StudySessionOutboxRecord>(SESSION_STORE);
  return records
    .filter((record) => record.userId === userId)
    .sort((left, right) => left.updatedAt - right.updatedAt);
}

export async function markStudySessionSnapshotSuccess(key: string, revision: number): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const store = tx.objectStore(SESSION_STORE);
    const read = store.get(key);
    read.onsuccess = () => {
      const existing = read.result as StudySessionOutboxRecord | undefined;
      if (!existing || existing.revision <= revision) store.delete(key);
    };
    read.onerror = () => reject(read.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function markStudySessionSnapshotFailed(key: string, revision: number, error: unknown): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const store = tx.objectStore(SESSION_STORE);
    const read = store.get(key);
    read.onsuccess = () => {
      const existing = read.result as StudySessionOutboxRecord | undefined;
      if (!existing || existing.revision !== revision) return;
      store.put({
        ...existing,
        state: "failed",
        attempts: existing.attempts + 1,
        updatedAt: Date.now(),
        lastError: error instanceof Error ? error.message : String(error ?? "study-session-sync-failed"),
      });
    };
    read.onerror = () => reject(read.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function enqueueStudyProgress(
  input: Omit<StudyProgressOutboxRecord, "createdAt" | "updatedAt" | "state" | "attempts" | "lastError">,
): Promise<void> {
  const existing = await getRecord<StudyProgressOutboxRecord>(PROGRESS_STORE, input.operationId);
  if (existing) return;
  const now = Date.now();
  await putRecord(PROGRESS_STORE, {
    ...input,
    createdAt: now,
    updatedAt: now,
    state: "pending",
    attempts: 0,
    lastError: null,
  } satisfies StudyProgressOutboxRecord);
}

export async function listPendingStudyProgress(userId: string): Promise<StudyProgressOutboxRecord[]> {
  const records = await getAllRecords<StudyProgressOutboxRecord>(PROGRESS_STORE);
  return records
    .filter((record) => record.userId === userId)
    .sort((left, right) => left.createdAt - right.createdAt);
}

export async function markStudyProgressSuccess(operationId: string): Promise<void> {
  await deleteRecord(PROGRESS_STORE, operationId);
}

export async function markStudyProgressFailed(operationId: string, error: unknown): Promise<void> {
  const existing = await getRecord<StudyProgressOutboxRecord>(PROGRESS_STORE, operationId);
  if (!existing) return;
  await putRecord(PROGRESS_STORE, {
    ...existing,
    state: "failed",
    attempts: existing.attempts + 1,
    updatedAt: Date.now(),
    lastError: error instanceof Error ? error.message : String(error ?? "study-progress-sync-failed"),
  });
}

export async function requeueStudyOutbox(userId: string): Promise<void> {
  const [sessions, progress] = await Promise.all([
    listPendingStudySessionSnapshots(userId),
    listPendingStudyProgress(userId),
  ]);
  await Promise.all([
    ...sessions.filter((record) => record.state === "failed").map((record) => putRecord(SESSION_STORE, {
      ...record,
      state: "pending",
      updatedAt: Date.now(),
    })),
    ...progress.filter((record) => record.state === "failed").map((record) => putRecord(PROGRESS_STORE, {
      ...record,
      state: "pending",
      updatedAt: Date.now(),
    })),
  ]);
}

/** Test-only cleanup; production never truncates this store. */
export async function __resetStudyOutboxForTests(): Promise<void> {
  if (!isBrowser()) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
