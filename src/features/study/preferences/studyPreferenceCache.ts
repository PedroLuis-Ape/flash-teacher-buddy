import {
  DEFAULT_STUDY_PRESET,
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
  type StudyPreset,
  type StudyPresetOverride,
} from "./studyPreset";

export type PendingPreferenceWrite =
  | { kind: "global-upsert"; preset: StudyPreset; updatedAt: number }
  | { kind: "list-upsert"; listId: string; override: StudyPresetOverride; updatedAt: number }
  | { kind: "list-delete"; listId: string; updatedAt: number };

const globalKey = (userId: string) => `studyPreferences:v3:${userId}:global`;
const listKey = (userId: string, listId: string) => `studyPreferences:v3:${userId}:list:${listId}`;
const pendingKey = (userId: string) => `studyPreferences:v3:${userId}:pending`;
const legacyKey = (userId: string) => `studyPreferences:${userId}`;

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full. Preferences remain in memory.
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

export function readGlobalCache(userId: string): StudyPreset | null {
  const parsed = safeParse(safeGet(globalKey(userId)));
  if (!parsed || typeof parsed !== "object") return null;
  return normalizeStudyPreset(parsed);
}

export function writeGlobalCache(userId: string, preset: StudyPreset): void {
  safeSet(globalKey(userId), { version: 3, ...normalizeStudyPreset(preset) });
}

export function readListOverrideCache(userId: string, listId: string): StudyPresetOverride | null {
  const parsed = safeParse(safeGet(listKey(userId, listId)));
  if (!parsed || typeof parsed !== "object") return null;
  const normalized = normalizeStudyPresetOverride(parsed);
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function writeListOverrideCache(
  userId: string,
  listId: string,
  override: StudyPresetOverride,
): void {
  const normalized = normalizeStudyPresetOverride(override);
  if (Object.keys(normalized).length === 0) {
    removeListOverrideCache(userId, listId);
    return;
  }
  safeSet(listKey(userId, listId), { version: 3, ...normalized });
}

export function removeListOverrideCache(userId: string, listId: string): void {
  safeRemove(listKey(userId, listId));
}

function normalizePendingWrite(value: unknown): PendingPreferenceWrite | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const updatedAt = typeof input.updatedAt === "number" ? input.updatedAt : Date.now();

  if (input.kind === "global-upsert") {
    return { kind: "global-upsert", preset: normalizeStudyPreset(input.preset), updatedAt };
  }
  if (input.kind === "list-upsert" && typeof input.listId === "string") {
    const override = normalizeStudyPresetOverride(input.override);
    if (Object.keys(override).length === 0) {
      return { kind: "list-delete", listId: input.listId, updatedAt };
    }
    return { kind: "list-upsert", listId: input.listId, override, updatedAt };
  }
  if (input.kind === "list-delete" && typeof input.listId === "string") {
    return { kind: "list-delete", listId: input.listId, updatedAt };
  }
  return null;
}

export function readPendingPreferenceWrites(userId: string): PendingPreferenceWrite[] {
  const parsed = safeParse(safeGet(pendingKey(userId)));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizePendingWrite)
    .filter((item): item is PendingPreferenceWrite => item !== null)
    .sort((left, right) => left.updatedAt - right.updatedAt);
}

export function replacePendingPreferenceWrites(
  userId: string,
  writes: PendingPreferenceWrite[],
): void {
  if (writes.length === 0) {
    safeRemove(pendingKey(userId));
    return;
  }
  safeSet(pendingKey(userId), writes);
}

export function enqueuePendingPreferenceWrite(
  userId: string,
  write: PendingPreferenceWrite,
): void {
  const existing = readPendingPreferenceWrites(userId);
  const keyFor = (item: PendingPreferenceWrite) =>
    item.kind === "global-upsert" ? "global" : `list:${item.listId}`;
  const targetKey = keyFor(write);
  const next = existing.filter((item) => keyFor(item) !== targetKey);
  next.push(write);
  replacePendingPreferenceWrites(userId, next.sort((left, right) => left.updatedAt - right.updatedAt));
}

export function migrateLegacyStudyPreferences(userId: string): StudyPreset | null {
  const current = readGlobalCache(userId);
  if (current) return current;

  const parsed = safeParse(safeGet(legacyKey(userId)));
  if (!parsed || typeof parsed !== "object") return null;
  const input = parsed as Record<string, unknown>;
  const migrated = normalizeStudyPreset({
    mode: input.mode,
    direction: input.direction,
    order: input.order,
    scope: input.favoritesOnly === true ? "favorites" : "all",
    fastMode: input.fastMode,
  });

  writeGlobalCache(userId, migrated);
  return migrated;
}

export function readOrCreateGlobalCache(userId: string): StudyPreset {
  return readGlobalCache(userId)
    ?? migrateLegacyStudyPreferences(userId)
    ?? { ...DEFAULT_STUDY_PRESET };
}
