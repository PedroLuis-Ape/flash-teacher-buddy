import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Direction } from "@/features/study/lib/gameCore";
import { normalizeStudyMode } from "@/features/study/lib/studyMode";
import {
  DEFAULT_STUDY_PRESET,
  diffStudyPreset,
  isEmptyStudyPresetOverride,
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
  resolveStudyPreset,
  type StudyPreset,
  type StudyPresetOverride,
  type StudySessionOverrides,
} from "@/features/study/preferences/studyPreset";
import {
  enqueuePendingPreferenceWrite,
  migrateLegacyStudyPreferences,
  readGlobalCache,
  readListOverrideCache,
  readPendingPreferenceWrites,
  removeListOverrideCache,
  replacePendingPreferenceWrites,
  stagePendingPreferenceWrites,
  STUDY_PREFERENCE_CACHE_CHANGED_EVENT,
  writeGlobalCache,
  writeListOverrideCache,
  type PendingPreferenceWrite,
  type StudyPreferenceCacheChangedDetail,
} from "@/features/study/preferences/studyPreferenceCache";
import {
  createStudyPreferenceRepository,
  isMissingStudyPreferenceSchemaError,
  isRetryableStudyPreferenceError,
} from "@/features/study/preferences/studyPreferenceRepository";

export interface StudyPreferences {
  favoritesOnly: boolean;
  order: "random" | "sequential";
  direction: Direction;
  mode: string;
  fastMode: boolean;
}

export type StudyPreferenceSource = "defaults" | "global" | "list";

export type UseStudyPreferencesOptions = {
  listId?: string;
  gameMode?: string;
  persistScope?: "global" | "list";
  canPersistList?: boolean;
  persistEnabled?: boolean;
  sessionOverrides?: StudySessionOverrides;
};

export const STUDY_PREFERENCES_VERSION = 4;
export const STUDY_DIRECTION_MANUAL_EVENT = "piteco:study-direction-manual";
export const STUDY_RED_FOCUS_TRANSITION_EVENT = "piteco:study-red-focus-transition";

const repository = createStudyPreferenceRepository();
const WRITE_DEBOUNCE_MS = 300;

type ScheduledPreferenceWrite = {
  timer: ReturnType<typeof setTimeout>;
  write: PendingPreferenceWrite;
};

function userScope(userId: string | undefined): string {
  return userId || "anon";
}

function scopedDefault(gameMode: StudyPreset["mode"]): StudyPreset {
  return normalizeStudyPreset({ ...DEFAULT_STUDY_PRESET, mode: gameMode });
}

export function derivePrivateListId(pathname?: string): string | undefined {
  const path = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const match = path.match(/^\/list\/([^/]+)(?:\/|$)/);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function shouldPersistStudyPreferences(
  pathname?: string,
  explicit?: boolean,
): boolean {
  if (typeof explicit === "boolean") return explicit;
  const path = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  return !path.startsWith("/portal/");
}

export function stripTransientRedFocusOrder(
  partial: Partial<StudyPreferences>,
  redFocusTransition: boolean,
): Partial<StudyPreferences> {
  return redFocusTransition ? {} : partial;
}

export function selectChangedLegacyPreferences(
  partial: Partial<StudyPreferences>,
  current: StudyPreferences,
): Partial<StudyPreferences> {
  const changed: Partial<StudyPreferences> = {};

  if (partial.mode !== undefined && normalizeStudyMode(partial.mode) !== normalizeStudyMode(current.mode)) {
    changed.mode = partial.mode;
  }
  if (partial.direction !== undefined && partial.direction !== current.direction) {
    changed.direction = partial.direction;
  }
  if (partial.order !== undefined && partial.order !== current.order) {
    changed.order = partial.order;
  }
  if (partial.favoritesOnly !== undefined && partial.favoritesOnly !== current.favoritesOnly) {
    changed.favoritesOnly = partial.favoritesOnly;
  }
  if (partial.fastMode !== undefined && partial.fastMode !== current.fastMode) {
    changed.fastMode = partial.fastMode;
  }

  return changed;
}

function notifyDirectionUrlChange(direction: Direction): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("dir", direction);
    url.searchParams.delete("direction");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new Event("popstate"));
  } catch {
    // URL synchronization is a stability helper; persistence still succeeds.
  }
}

function presetToLegacy(preset: StudyPreset): StudyPreferences {
  return {
    favoritesOnly: preset.scope === "favorites",
    order: preset.order,
    direction: preset.direction,
    mode: preset.mode,
    fastMode: preset.fastMode,
  };
}

function legacyPatchToPreset(partial: Partial<StudyPreferences>): StudyPresetOverride {
  const result: StudyPresetOverride = {};
  if (partial.mode !== undefined) result.mode = normalizeStudyMode(partial.mode);
  if (partial.direction !== undefined && ["a-b", "b-a", "any"].includes(partial.direction)) {
    result.direction = partial.direction;
  }
  if (partial.order !== undefined) result.order = partial.order;
  if (partial.favoritesOnly !== undefined) result.scope = partial.favoritesOnly ? "favorites" : "all";
  if (partial.fastMode !== undefined) result.fastMode = partial.fastMode;
  return normalizeStudyPresetOverride(result);
}

export function normalizeStoredStudyPreferences(value: unknown): StudyPreferences {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const currentVersion = Number(input.version) >= STUDY_PREFERENCES_VERSION;
  const direction = currentVersion && ["a-b", "b-a", "any"].includes(String(input.direction ?? ""))
    ? input.direction
    : "any";
  return presetToLegacy(normalizeStudyPreset({
    mode: input.mode,
    direction,
    order: input.order,
    scope: input.scope ?? (input.favoritesOnly === true ? "favorites" : "all"),
    fastMode: input.fastMode,
  }));
}

export function parseStudySessionOverrides(params: URLSearchParams): StudySessionOverrides {
  const result: StudySessionOverrides = {};
  const mode = params.get("mode");
  if (mode) result.mode = normalizeStudyMode(mode);

  const direction = params.get("dir") || params.get("direction");
  if (direction && ["a-b", "b-a", "any"].includes(direction)) {
    result.direction = direction as StudyPreset["direction"];
  }

  const order = params.get("order");
  if (order === "random" || order === "sequential") result.order = order;

  const favorites = params.get("favorites");
  if (favorites === "true" || favorites === "false") {
    result.scope = favorites === "true" ? "favorites" : "all";
  }

  const fastMode = params.get("fastMode") || params.get("fast");
  if (fastMode === "true" || fastMode === "false") result.fastMode = fastMode === "true";

  return normalizeStudyPresetOverride(result);
}

function readWindowSessionOverrides(): StudySessionOverrides {
  if (typeof window === "undefined") return {};
  try {
    return parseStudySessionOverrides(new URLSearchParams(window.location.search));
  } catch {
    return {};
  }
}

function pendingWriteKey(write: PendingPreferenceWrite): string {
  return write.kind === "global-upsert"
    ? `${write.gameMode}:global`
    : `${write.gameMode}:list:${write.listId}`;
}

function removeMatchingPendingWrite(scope: string, completed: PendingPreferenceWrite): void {
  const key = pendingWriteKey(completed);
  replacePendingPreferenceWrites(
    scope,
    readPendingPreferenceWrites(scope).filter((item) => pendingWriteKey(item) !== key),
  );
}

async function executePendingWrite(userId: string, write: PendingPreferenceWrite): Promise<void> {
  if (write.kind === "global-upsert") {
    await repository.upsertGlobal(userId, write.gameMode, write.preset);
  } else if (write.kind === "list-upsert") {
    await repository.upsertListOverride(userId, write.listId, write.gameMode, write.override);
  } else {
    await repository.deleteListOverride(userId, write.listId, write.gameMode);
  }
}

export function useStudyPreferences(
  userId: string | undefined,
  options: UseStudyPreferencesOptions = {},
) {
  const scope = userScope(userId);
  const inferredListId = derivePrivateListId();
  const listId = options.listId ?? inferredListId;
  const canPersistList = options.canPersistList ?? Boolean(listId);
  const persistenceEnabled = shouldPersistStudyPreferences(undefined, options.persistEnabled);
  const persistenceScope = options.persistScope
    ?? (listId && canPersistList ? "list" : "global");
  const windowSessionOverrides = readWindowSessionOverrides();
  const activeMode = normalizeStudyMode(
    options.gameMode
      ?? options.sessionOverrides?.mode
      ?? windowSessionOverrides.mode
      ?? DEFAULT_STUDY_PRESET.mode,
  ) as StudyPreset["mode"];

  const initialGlobal = readGlobalCache(scope, activeMode)
    ?? migrateLegacyStudyPreferences(scope, activeMode)
    ?? scopedDefault(activeMode);
  const initialListOverride = listId ? readListOverrideCache(scope, activeMode, listId) : null;
  const initialSessionOverrides = normalizeStudyPresetOverride({
    ...windowSessionOverrides,
    ...options.sessionOverrides,
    mode: activeMode,
  });

  const [globalPreset, setGlobalPreset] = useState<StudyPreset>(initialGlobal);
  const [listOverride, setListOverride] = useState<StudyPresetOverride | null>(initialListOverride);
  const [sessionOverrides, setSessionOverridesState] = useState<StudySessionOverrides>(initialSessionOverrides);
  const [isHydrating, setIsHydrating] = useState(Boolean(userId));
  const [hasPersistedGlobal, setHasPersistedGlobal] = useState(Boolean(readGlobalCache(scope, activeMode)));
  const timersRef = useRef(new Map<string, ScheduledPreferenceWrite>());
  const manualRevisionRef = useRef(0);
  const redFocusTransitionRef = useRef(false);

  const effectivePreset = useMemo(() => normalizeStudyPreset({
    ...resolveStudyPreset({
      globalPreset,
      listOverride,
      sessionOverrides,
    }),
    mode: activeMode,
  }), [activeMode, globalPreset, listOverride, sessionOverrides]);

  const source: StudyPreferenceSource = listOverride && !isEmptyStudyPresetOverride(listOverride)
    ? "list"
    : hasPersistedGlobal
      ? "global"
      : "defaults";

  const runWrite = useCallback(async (write: PendingPreferenceWrite) => {
    if (!userId || !persistenceEnabled) return;
    try {
      await executePendingWrite(userId, write);
      removeMatchingPendingWrite(scope, write);
    } catch (error) {
      if (isRetryableStudyPreferenceError(error) || isMissingStudyPreferenceSchemaError(error)) {
        enqueuePendingPreferenceWrite(scope, write);
      } else {
        console.warn("[StudyPreferences] Falha ao salvar preferência", error);
      }
    }
  }, [persistenceEnabled, scope, userId]);

  const scheduleWrite = useCallback((write: PendingPreferenceWrite) => {
    if (!userId || !persistenceEnabled) return;
    const key = pendingWriteKey(write);
    const current = timersRef.current.get(key);
    if (current) clearTimeout(current.timer);

    const timer = setTimeout(() => {
      timersRef.current.delete(key);
      void runWrite(write);
    }, WRITE_DEBOUNCE_MS);
    timersRef.current.set(key, { timer, write });
  }, [persistenceEnabled, runWrite, userId]);

  const flushPending = useCallback(async () => {
    if (!userId || !persistenceEnabled) return;
    const remaining: PendingPreferenceWrite[] = [];
    for (const write of readPendingPreferenceWrites(scope)) {
      try {
        await executePendingWrite(userId, write);
      } catch (error) {
        if (isRetryableStudyPreferenceError(error) || isMissingStudyPreferenceSchemaError(error)) {
          remaining.push(write);
        } else {
          console.warn("[StudyPreferences] Preferência pendente rejeitada", error);
        }
      }
    }
    replacePendingPreferenceWrites(scope, remaining);
  }, [persistenceEnabled, scope, userId]);

  useEffect(() => {
    const nextScope = userScope(userId);
    const cachedGlobal = readGlobalCache(nextScope, activeMode)
      ?? migrateLegacyStudyPreferences(nextScope, activeMode)
      ?? scopedDefault(activeMode);
    const cachedList = listId ? readListOverrideCache(nextScope, activeMode, listId) : null;
    const nextSession = normalizeStudyPresetOverride({
      ...readWindowSessionOverrides(),
      ...options.sessionOverrides,
      mode: activeMode,
    });

    setGlobalPreset(cachedGlobal);
    setListOverride(cachedList);
    setSessionOverridesState(nextSession);
    setHasPersistedGlobal(Boolean(readGlobalCache(nextScope, activeMode)));

    if (!userId) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    const revisionAtStart = manualRevisionRef.current;
    setIsHydrating(true);

    void (async () => {
      try {
        await flushPending();
        const [serverGlobalResult, serverListResult] = await Promise.allSettled([
          repository.readGlobal(userId, activeMode),
          listId ? repository.readListOverride(userId, listId, activeMode) : Promise.resolve(null),
        ]);
        if (cancelled || revisionAtStart !== manualRevisionRef.current) return;

        if (serverGlobalResult.status === "fulfilled") {
          if (serverGlobalResult.value) {
            setGlobalPreset(serverGlobalResult.value);
            writeGlobalCache(nextScope, activeMode, serverGlobalResult.value);
            setHasPersistedGlobal(true);
          } else if (persistenceEnabled) {
            writeGlobalCache(nextScope, activeMode, cachedGlobal);
            setHasPersistedGlobal(true);
            await runWrite({
              kind: "global-upsert",
              gameMode: activeMode,
              preset: cachedGlobal,
              updatedAt: Date.now(),
            });
          }
        } else if (!isMissingStudyPreferenceSchemaError(serverGlobalResult.reason)) {
          console.warn("[StudyPreferences] Falha ao hidratar preset global", serverGlobalResult.reason);
        }

        if (listId && serverListResult.status === "fulfilled") {
          const serverOverride = serverListResult.value;
          setListOverride(serverOverride);
          if (serverOverride) writeListOverrideCache(nextScope, activeMode, listId, serverOverride);
          else removeListOverrideCache(nextScope, activeMode, listId);
        } else if (serverListResult.status === "rejected"
          && !isMissingStudyPreferenceSchemaError(serverListResult.reason)) {
          console.warn("[StudyPreferences] Falha ao hidratar preset da lista", serverListResult.reason);
        }
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    flushPending,
    listId,
    options.sessionOverrides,
    persistenceEnabled,
    runWrite,
    userId,
  ]);

  useEffect(() => {
    setSessionOverridesState(normalizeStudyPresetOverride({
      ...readWindowSessionOverrides(),
      ...options.sessionOverrides,
      mode: activeMode,
    }));
  }, [activeMode, options.sessionOverrides]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromCache = () => {
      const nextGlobal = readGlobalCache(scope, activeMode) ?? scopedDefault(activeMode);
      const nextList = listId ? readListOverrideCache(scope, activeMode, listId) : null;
      setGlobalPreset(nextGlobal);
      setListOverride(nextList);
      setHasPersistedGlobal(Boolean(readGlobalCache(scope, activeMode)));
    };

    const handleCacheChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudyPreferenceCacheChangedDetail>).detail;
      if (!detail || detail.userId !== scope || detail.gameMode !== activeMode) return;
      if (detail.scope === "list" && detail.listId !== listId) return;
      syncFromCache();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.includes(`studyPreferences:v4:${scope}:mode:${activeMode}:`)) return;
      syncFromCache();
    };

    window.addEventListener(STUDY_PREFERENCE_CACHE_CHANGED_EVENT, handleCacheChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(STUDY_PREFERENCE_CACHE_CHANGED_EVENT, handleCacheChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [activeMode, listId, scope]);

  useEffect(() => {
    if (typeof window === "undefined" || !userId || !persistenceEnabled) return;
    const handleOnline = () => void flushPending();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushPending, persistenceEnabled, userId]);

  useEffect(() => () => {
    const scheduled = Array.from(timersRef.current.values());
    scheduled.forEach(({ timer }) => clearTimeout(timer));
    if (persistenceEnabled && scheduled.length > 0) {
      stagePendingPreferenceWrites(scope, scheduled.map(({ write }) => write));
    }
    timersRef.current.clear();
  }, [persistenceEnabled, scope]);

  const clearSessionKeys = useCallback((partial: StudyPresetOverride) => {
    setSessionOverridesState((current) => {
      const next = { ...current };
      (Object.keys(partial) as Array<keyof StudyPreset>).forEach((key) => delete next[key]);
      next.mode = activeMode;
      return next;
    });
  }, [activeMode]);

  const updateForCurrentScope = useCallback((partial: Partial<StudyPreset>) => {
    const normalizedPartial = normalizeStudyPresetOverride(partial);
    delete normalizedPartial.mode;
    if (isEmptyStudyPresetOverride(normalizedPartial)) return;
    manualRevisionRef.current += 1;

    if (!persistenceEnabled) {
      setSessionOverridesState((current) => normalizeStudyPresetOverride({
        ...current,
        ...normalizedPartial,
        mode: activeMode,
      }));
      return;
    }

    clearSessionKeys(normalizedPartial);

    if (persistenceScope === "list" && listId) {
      const persistedEffective = normalizeStudyPreset({
        ...resolveStudyPreset({ globalPreset, listOverride }),
        mode: activeMode,
      });
      const nextEffective = normalizeStudyPreset({
        ...persistedEffective,
        ...normalizedPartial,
        mode: activeMode,
      });
      const nextOverride = diffStudyPreset(nextEffective, globalPreset);
      delete nextOverride.mode;
      if (isEmptyStudyPresetOverride(nextOverride)) {
        setListOverride(null);
        removeListOverrideCache(scope, activeMode, listId);
        scheduleWrite({ kind: "list-delete", gameMode: activeMode, listId, updatedAt: Date.now() });
      } else {
        setListOverride(nextOverride);
        writeListOverrideCache(scope, activeMode, listId, nextOverride);
        scheduleWrite({
          kind: "list-upsert",
          gameMode: activeMode,
          listId,
          override: nextOverride,
          updatedAt: Date.now(),
        });
      }
      return;
    }

    const nextGlobal = normalizeStudyPreset({
      ...globalPreset,
      ...normalizedPartial,
      mode: activeMode,
    });
    setGlobalPreset(nextGlobal);
    setHasPersistedGlobal(true);
    writeGlobalCache(scope, activeMode, nextGlobal);
    scheduleWrite({
      kind: "global-upsert",
      gameMode: activeMode,
      preset: nextGlobal,
      updatedAt: Date.now(),
    });
  }, [
    activeMode,
    clearSessionKeys,
    globalPreset,
    listId,
    listOverride,
    persistenceEnabled,
    persistenceScope,
    scheduleWrite,
    scope,
  ]);

  const saveAsGlobal = useCallback(async (preset: StudyPreset = effectivePreset) => {
    if (!persistenceEnabled) return;
    const normalized = normalizeStudyPreset({ ...preset, mode: activeMode });
    manualRevisionRef.current += 1;
    setGlobalPreset(normalized);
    setHasPersistedGlobal(true);
    writeGlobalCache(scope, activeMode, normalized);

    if (listId) {
      setListOverride(null);
      removeListOverrideCache(scope, activeMode, listId);
    }

    if (userId) {
      await runWrite({
        kind: "global-upsert",
        gameMode: activeMode,
        preset: normalized,
        updatedAt: Date.now(),
      });
      if (listId) {
        await runWrite({ kind: "list-delete", gameMode: activeMode, listId, updatedAt: Date.now() });
      }
    }
  }, [activeMode, effectivePreset, listId, persistenceEnabled, runWrite, scope, userId]);

  const resetListOverride = useCallback(async () => {
    if (!listId || !persistenceEnabled) return;
    manualRevisionRef.current += 1;
    setListOverride(null);
    removeListOverrideCache(scope, activeMode, listId);
    if (userId) {
      await runWrite({ kind: "list-delete", gameMode: activeMode, listId, updatedAt: Date.now() });
    }
  }, [activeMode, listId, persistenceEnabled, runWrite, scope, userId]);

  const setSessionOverrides = useCallback((overrides: StudySessionOverrides) => {
    setSessionOverridesState(normalizeStudyPresetOverride({ ...overrides, mode: activeMode }));
  }, [activeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleManualDirection = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: Direction }>).detail?.direction;
      if (direction && ["a-b", "b-a", "any"].includes(direction)) {
        updateForCurrentScope({ direction });
      }
    };
    window.addEventListener(STUDY_DIRECTION_MANUAL_EVENT, handleManualDirection);
    return () => window.removeEventListener(STUDY_DIRECTION_MANUAL_EVENT, handleManualDirection);
  }, [updateForCurrentScope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRedFocusTransition = () => {
      redFocusTransitionRef.current = true;
    };
    window.addEventListener(STUDY_RED_FOCUS_TRANSITION_EVENT, handleRedFocusTransition);
    return () => window.removeEventListener(STUDY_RED_FOCUS_TRANSITION_EVENT, handleRedFocusTransition);
  }, []);

  const prefs = useMemo(() => presetToLegacy(effectivePreset), [effectivePreset]);

  const updatePrefs = useCallback((partial: Partial<StudyPreferences>) => {
    const changedPartial = selectChangedLegacyPreferences(partial, prefs);
    delete changedPartial.mode;
    const persistentPartial = stripTransientRedFocusOrder(changedPartial, redFocusTransitionRef.current);
    redFocusTransitionRef.current = false;
    if (persistentPartial.direction) notifyDirectionUrlChange(persistentPartial.direction);
    updateForCurrentScope(legacyPatchToPreset(persistentPartial));
  }, [prefs, updateForCurrentScope]);

  const applyUrlOverrides = useCallback((params: URLSearchParams) => {
    setSessionOverrides({ ...parseStudySessionOverrides(params), mode: activeMode });
  }, [activeMode, setSessionOverrides]);

  return {
    effectivePreset,
    globalPreset,
    listOverride,
    sessionOverrides,
    source,
    isHydrating,
    updateForCurrentScope,
    saveAsGlobal,
    resetListOverride,
    setSessionOverrides,
    flushPending,
    prefs,
    updatePrefs,
    applyUrlOverrides,
  };
}
