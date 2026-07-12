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
  writeGlobalCache,
  writeListOverrideCache,
  type PendingPreferenceWrite,
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
  persistScope?: "global" | "list";
  canPersistList?: boolean;
  sessionOverrides?: StudySessionOverrides;
};

export const STUDY_PREFERENCES_VERSION = 3;
const repository = createStudyPreferenceRepository();
const WRITE_DEBOUNCE_MS = 300;

function userScope(userId: string | undefined): string {
  return userId || "anon";
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
  const preset = normalizeStudyPreset({
    mode: input.mode,
    direction,
    order: input.order,
    scope: input.scope ?? (input.favoritesOnly === true ? "favorites" : "all"),
    fastMode: input.fastMode,
  });
  return presetToLegacy(preset);
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
  return write.kind === "global-upsert" ? "global" : `list:${write.listId}`;
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
    await repository.upsertGlobal(userId, write.preset);
    return;
  }
  if (write.kind === "list-upsert") {
    await repository.upsertListOverride(userId, write.listId, write.override);
    return;
  }
  await repository.deleteListOverride(userId, write.listId);
}

export function useStudyPreferences(
  userId: string | undefined,
  options: UseStudyPreferencesOptions = {},
) {
  const scope = userScope(userId);
  const listId = options.listId;
  const canPersistList = options.canPersistList !== false;
  const persistenceScope = options.persistScope
    ?? (listId && canPersistList ? "list" : "global");

  const initialGlobal = readGlobalCache(scope)
    ?? migrateLegacyStudyPreferences(scope)
    ?? { ...DEFAULT_STUDY_PRESET };
  const initialListOverride = listId ? readListOverrideCache(scope, listId) : null;
  const initialSessionOverrides = normalizeStudyPresetOverride({
    ...readWindowSessionOverrides(),
    ...options.sessionOverrides,
  });

  const [globalPreset, setGlobalPreset] = useState<StudyPreset>(initialGlobal);
  const [listOverride, setListOverride] = useState<StudyPresetOverride | null>(initialListOverride);
  const [sessionOverrides, setSessionOverridesState] = useState<StudySessionOverrides>(initialSessionOverrides);
  const [isHydrating, setIsHydrating] = useState(Boolean(userId));
  const [hasPersistedGlobal, setHasPersistedGlobal] = useState(Boolean(readGlobalCache(scope)));
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const manualRevisionRef = useRef(0);

  const effectivePreset = useMemo(() => resolveStudyPreset({
    globalPreset,
    listOverride,
    sessionOverrides,
  }), [globalPreset, listOverride, sessionOverrides]);

  const source: StudyPreferenceSource = listOverride && !isEmptyStudyPresetOverride(listOverride)
    ? "list"
    : hasPersistedGlobal
      ? "global"
      : "defaults";

  const runWrite = useCallback(async (write: PendingPreferenceWrite) => {
    if (!userId) return;
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
  }, [scope, userId]);

  const scheduleWrite = useCallback((write: PendingPreferenceWrite) => {
    if (!userId) return;
    const key = pendingWriteKey(write);
    const current = timersRef.current.get(key);
    if (current) clearTimeout(current);
    timersRef.current.set(key, setTimeout(() => {
      timersRef.current.delete(key);
      void runWrite(write);
    }, WRITE_DEBOUNCE_MS));
  }, [runWrite, userId]);

  const flushPending = useCallback(async () => {
    if (!userId) return;
    const pending = readPendingPreferenceWrites(scope);
    const remaining: PendingPreferenceWrite[] = [];
    for (const write of pending) {
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
  }, [scope, userId]);

  useEffect(() => {
    const nextScope = userScope(userId);
    const cachedGlobal = readGlobalCache(nextScope)
      ?? migrateLegacyStudyPreferences(nextScope)
      ?? { ...DEFAULT_STUDY_PRESET };
    const cachedList = listId ? readListOverrideCache(nextScope, listId) : null;
    const nextSession = normalizeStudyPresetOverride({
      ...readWindowSessionOverrides(),
      ...options.sessionOverrides,
    });

    setGlobalPreset(cachedGlobal);
    setListOverride(cachedList);
    setSessionOverridesState(nextSession);
    setHasPersistedGlobal(Boolean(readGlobalCache(nextScope)));

    if (!userId) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    const revisionAtStart = manualRevisionRef.current;
    setIsHydrating(true);

    void (async () => {
      try {
        const [serverGlobalResult, serverListResult] = await Promise.allSettled([
          repository.readGlobal(userId),
          listId ? repository.readListOverride(userId, listId) : Promise.resolve(null),
        ]);
        if (cancelled || revisionAtStart !== manualRevisionRef.current) return;

        if (serverGlobalResult.status === "fulfilled") {
          if (serverGlobalResult.value) {
            setGlobalPreset(serverGlobalResult.value);
            writeGlobalCache(nextScope, serverGlobalResult.value);
            setHasPersistedGlobal(true);
          } else {
            writeGlobalCache(nextScope, cachedGlobal);
            setHasPersistedGlobal(true);
            await runWrite({ kind: "global-upsert", preset: cachedGlobal, updatedAt: Date.now() });
          }
        } else if (!isMissingStudyPreferenceSchemaError(serverGlobalResult.reason)) {
          console.warn("[StudyPreferences] Falha ao hidratar preset global", serverGlobalResult.reason);
        }

        if (listId && serverListResult.status === "fulfilled") {
          const serverOverride = serverListResult.value;
          setListOverride(serverOverride);
          if (serverOverride) writeListOverrideCache(nextScope, listId, serverOverride);
          else removeListOverrideCache(nextScope, listId);
        } else if (serverListResult.status === "rejected"
          && !isMissingStudyPreferenceSchemaError(serverListResult.reason)) {
          console.warn("[StudyPreferences] Falha ao hidratar preset da lista", serverListResult.reason);
        }

        await flushPending();
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, listId]);

  useEffect(() => {
    setSessionOverridesState(normalizeStudyPresetOverride({
      ...readWindowSessionOverrides(),
      ...options.sessionOverrides,
    }));
  }, [options.sessionOverrides]);

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    const handleOnline = () => void flushPending();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushPending, userId]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const clearSessionKeys = useCallback((partial: StudyPresetOverride) => {
    setSessionOverridesState((current) => {
      const next = { ...current };
      (Object.keys(partial) as Array<keyof StudyPreset>).forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  const updateForCurrentScope = useCallback((partial: Partial<StudyPreset>) => {
    const normalizedPartial = normalizeStudyPresetOverride(partial);
    if (isEmptyStudyPresetOverride(normalizedPartial)) return;
    manualRevisionRef.current += 1;
    clearSessionKeys(normalizedPartial);

    if (persistenceScope === "list" && listId) {
      const persistedEffective = resolveStudyPreset({ globalPreset, listOverride });
      const nextEffective = normalizeStudyPreset({ ...persistedEffective, ...normalizedPartial });
      const nextOverride = diffStudyPreset(nextEffective, globalPreset);
      if (isEmptyStudyPresetOverride(nextOverride)) {
        setListOverride(null);
        removeListOverrideCache(scope, listId);
        scheduleWrite({ kind: "list-delete", listId, updatedAt: Date.now() });
      } else {
        setListOverride(nextOverride);
        writeListOverrideCache(scope, listId, nextOverride);
        scheduleWrite({ kind: "list-upsert", listId, override: nextOverride, updatedAt: Date.now() });
      }
      return;
    }

    const nextGlobal = normalizeStudyPreset({ ...globalPreset, ...normalizedPartial });
    setGlobalPreset(nextGlobal);
    setHasPersistedGlobal(true);
    writeGlobalCache(scope, nextGlobal);
    scheduleWrite({ kind: "global-upsert", preset: nextGlobal, updatedAt: Date.now() });
  }, [clearSessionKeys, globalPreset, listId, listOverride, persistenceScope, scheduleWrite, scope]);

  const saveAsGlobal = useCallback(async (preset: StudyPreset = effectivePreset) => {
    const normalized = normalizeStudyPreset(preset);
    manualRevisionRef.current += 1;
    setGlobalPreset(normalized);
    setHasPersistedGlobal(true);
    writeGlobalCache(scope, normalized);

    if (listId) {
      setListOverride(null);
      removeListOverrideCache(scope, listId);
    }

    if (userId) {
      await runWrite({ kind: "global-upsert", preset: normalized, updatedAt: Date.now() });
      if (listId) await runWrite({ kind: "list-delete", listId, updatedAt: Date.now() });
    }
  }, [effectivePreset, listId, runWrite, scope, userId]);

  const resetListOverride = useCallback(async () => {
    if (!listId) return;
    manualRevisionRef.current += 1;
    setListOverride(null);
    removeListOverrideCache(scope, listId);
    if (userId) await runWrite({ kind: "list-delete", listId, updatedAt: Date.now() });
  }, [listId, runWrite, scope, userId]);

  const setSessionOverrides = useCallback((overrides: StudySessionOverrides) => {
    setSessionOverridesState(normalizeStudyPresetOverride(overrides));
  }, []);

  const prefs = useMemo(() => presetToLegacy(effectivePreset), [effectivePreset]);

  const updatePrefs = useCallback((partial: Partial<StudyPreferences>) => {
    updateForCurrentScope(legacyPatchToPreset(partial));
  }, [updateForCurrentScope]);

  const applyUrlOverrides = useCallback((params: URLSearchParams) => {
    setSessionOverrides(parseStudySessionOverrides(params));
  }, [setSessionOverrides]);

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
    // Compatibility layer for existing call sites while GamesHub/Study migrate.
    prefs,
    updatePrefs,
    applyUrlOverrides,
  };
}
