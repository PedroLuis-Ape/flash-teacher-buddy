import {
  DEFAULT_STUDY_PRESET,
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
  type StudyPreset,
  type StudyPresetOverride,
} from "./studyPreset";

export type PendingPreferenceWrite =
  | { kind: "global-upsert"; gameMode: StudyPreset["mode"]; preset: StudyPreset; updatedAt: number }
  | {
    kind: "list-upsert";
    gameMode: StudyPreset["mode"];
    listId: string;
    override: StudyPresetOverride;
    updatedAt: number;
  }
  | { kind: "list-delete"; gameMode: StudyPreset["mode"]; listId: string; updatedAt: number };

export const STUDY_PREFERENCE_CACHE_CHANGED_EVENT = "piteco:study-preference-cache-changed";

export type StudyPreferenceCacheChangedDetail = {
  userId: string;
  gameMode: StudyPreset["mode"];
  scope: "global" | "list";
  listId?: string;
};

const CACHE_VERSION = 4;
const globalKey = (userId: string, gameMode: StudyPreset["mode"]) =>
  `studyPreferences:v${CACHE_VERSION}:${userId}:mode:${gameMode}:global`;
const listKey = (userId: string, gameMode: StudyPreset["mode"], listId: string) =>
  `studyPreferences:v${CACHE_VERSION}:${userId}:mode:${gameMode}:list:${listId}`;
const pendingKey = (userId: string) => `studyPreferences:v${CACHE_VERSION}:${userId}:pending`;
const legacyV3GlobalKey = (userId: string) => `studyPreferences:v3:${userId}:global`;
const legacyV3ListKey = (userId: string, listId: string) => `studyPreferences:v3:${userId}:list:${listId}`;
const legacyV3PendingKey = (userId: string) => `studyPreferences:v3:${userId}:pending`;
const legacyKey = (userId: string) => `studyPreferences:${userId}`;

function normalizeGameMode(value: unknown): StudyPreset["mode"] {
  return normalizeStudyPreset({ mode: value }).mode;
}

function scopedDefault(gameMode: StudyPreset["mode"]): StudyPreset {
  return normalizeStudyPreset({ ...DEFAULT_STUDY_PRESET, mode: gameMode });
}

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

function notifyCacheChange(detail: StudyPreferenceCacheChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STUDY_PREFERENCE_CACHE_CHANGED_EVENT, { detail }));
}

function readLegacyV3Global(userId: string): StudyPreset | null {
  const parsed = safeParse(safeGet(legacyV3GlobalKey(userId)));
  if (!parsed || typeof parsed !== "object") return null;
  return normalizeStudyPreset(parsed);
}

export function readGlobalCache(
  userId: string,
  gameMode: StudyPreset["mode"],
): StudyPreset | null {
  const normalizedMode = normalizeGameMode(gameMode);
  const parsed = safeParse(safeGet(globalKey(userId, normalizedMode)));
  if (parsed && typeof parsed === "object") {
    return normalizeStudyPreset({ ...parsed, mode: normalizedMode });
  }

  const legacy = readLegacyV3Global(userId);
  if (!legacy || legacy.mode !== normalizedMode) return null;
  const migrated = normalizeStudyPreset({ ...legacy, mode: normalizedMode });
  writeGlobalCache(userId, normalizedMode, migrated);
  return migrated;
}

export function writeGlobalCache(
  userId: string,
  gameMode: StudyPreset["mode"],
  preset: StudyPreset,
): void {
  const normalizedMode = normalizeGameMode(gameMode);
  safeSet(globalKey(userId, normalizedMode), {
    version: CACHE_VERSION,
    ...normalizeStudyPreset({ ...preset, mode: normalizedMode }),
  });
  notifyCacheChange({ userId, gameMode: normalizedMode, scope: "global" });
}

export function readListOverrideCache(
  userId: string,
  gameMode: StudyPreset["mode"],
  listId: string,
): StudyPresetOverride | null {
  const normalizedMode = normalizeGameMode(gameMode);
  const parsed = safeParse(safeGet(listKey(userId, normalizedMode, listId)));
  if (parsed && typeof parsed === "object") {
    const normalized = normalizeStudyPresetOverride(parsed);
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  const legacyGlobal = readLegacyV3Global(userId);
  const legacyParsed = safeParse(safeGet(legacyV3ListKey(userId, listId)));
  if (!legacyGlobal || legacyGlobal.mode !== normalizedMode || !legacyParsed || typeof legacyParsed !== "object") {
    return null;
  }

  const migrated = normalizeStudyPresetOverride(legacyParsed);
  if (migrated.mode && migrated.mode !== normalizedMode) return null;
  delete migrated.mode;
  if (Object.keys(migrated).length === 0) return null;
  writeListOverrideCache(userId, normalizedMode, listId, migrated);
  return migrated;
}

export function writeListOverrideCache(
  userId: string,
  gameMode: StudyPreset["mode"],
  listId: string,
  override: StudyPresetOverride,
): void {
  const normalizedMode = normalizeGameMode(gameMode);
  const normalized = normalizeStudyPresetOverride(override);
  delete normalized.mode;
  if (Object.keys(normalized).length === 0) {
    removeListOverrideCache(userId, normalizedMode, listId);
    return;
  }
  safeSet(listKey(userId, normalizedMode, listId), { version: CACHE_VERSION, ...normalized });
  notifyCacheChange({ userId, gameMode: normalizedMode, scope: "list", listId });
}

export function removeListOverrideCache(
  userId: string,
  gameMode: StudyPreset["mode"],
  listId: string,
): void {
  const normalizedMode = normalizeGameMode(gameMode);
  safeRemove(listKey(userId, normalizedMode, listId));
  notifyCacheChange({ userId, gameMode: normalizedMode, scope: "list", listId });
}

function normalizePendingWrite(
  value: unknown,
  fallbackMode?: StudyPreset["mode"],
): PendingPreferenceWrite | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const updatedAt = typeof input.updatedAt === "number" ? input.updatedAt : Date.now();

  if (input.kind === "global-upsert") {
    const preset = normalizeStudyPreset(input.preset);
    const gameMode = normalizeGameMode(input.gameMode ?? preset.mode ?? fallbackMode);
    return {
      kind: "global-upsert",
      gameMode,
      preset: normalizeStudyPreset({ ...preset, mode: gameMode }),
      updatedAt,
    };
  }
  if (input.kind === "list-upsert" && typeof input.listId === "string") {
    const override = normalizeStudyPresetOverride(input.override);
    const gameMode = normalizeGameMode(input.gameMode ?? override.mode ?? fallbackMode);
    delete override.mode;
    if (Object.keys(override).length === 0) {
      return { kind: "list-delete", gameMode, listId: input.listId, updatedAt };
    }
    return { kind: "list-upsert", gameMode, listId: input.listId, override, updatedAt };
  }
  if (input.kind === "list-delete" && typeof input.listId === "string") {
    const gameMode = normalizeGameMode(input.gameMode ?? fallbackMode);
    return { kind: "list-delete", gameMode, listId: input.listId, updatedAt };
  }
  return null;
}

export function readPendingPreferenceWrites(userId: string): PendingPreferenceWrite[] {
  const parsed = safeParse(safeGet(pendingKey(userId)));
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => normalizePendingWrite(item))
      .filter((item): item is PendingPreferenceWrite => item !== null)
      .sort((left, right) => left.updatedAt - right.updatedAt);
  }

  const legacyParsed = safeParse(safeGet(legacyV3PendingKey(userId)));
  if (!Array.isArray(legacyParsed)) return [];
  const fallbackMode = readLegacyV3Global(userId)?.mode;
  const migrated = legacyParsed
    .map((item) => normalizePendingWrite(item, fallbackMode))
    .filter((item): item is PendingPreferenceWrite => item !== null)
    .sort((left, right) => left.updatedAt - right.updatedAt);
  if (migrated.length > 0) replacePendingPreferenceWrites(userId, migrated);
  return migrated;
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
    item.kind === "global-upsert"
      ? `${item.gameMode}:global`
      : `${item.gameMode}:list:${item.listId}`;
  const targetKey = keyFor(write);
  const next = existing.filter((item) => keyFor(item) !== targetKey);
  next.push(write);
  replacePendingPreferenceWrites(userId, next.sort((left, right) => left.updatedAt - right.updatedAt));
}

export function stagePendingPreferenceWrites(
  userId: string,
  writes: PendingPreferenceWrite[],
): void {
  [...writes]
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .forEach((write) => enqueuePendingPreferenceWrite(userId, write));
}

export function migrateLegacyStudyPreferences(
  userId: string,
  gameMode: StudyPreset["mode"],
): StudyPreset | null {
  const normalizedMode = normalizeGameMode(gameMode);
  const current = readGlobalCache(userId, normalizedMode);
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
  if (migrated.mode !== normalizedMode) return null;

  writeGlobalCache(userId, normalizedMode, migrated);
  return migrated;
}

export function readOrCreateGlobalCache(
  userId: string,
  gameMode: StudyPreset["mode"],
): StudyPreset {
  const normalizedMode = normalizeGameMode(gameMode);
  return readGlobalCache(userId, normalizedMode)
    ?? migrateLegacyStudyPreferences(userId, normalizedMode)
    ?? scopedDefault(normalizedMode);
}
