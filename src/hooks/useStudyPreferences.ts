import { useState, useCallback, useEffect, useRef } from "react";
import type { Direction } from "@/features/study/lib/gameCore";

export interface StudyPreferences {
  favoritesOnly: boolean;
  order: "random" | "sequential";
  direction: Direction;
  mode: string;
  fastMode: boolean;
}

const DEFAULTS: StudyPreferences = {
  favoritesOnly: false,
  order: "random",
  direction: "any",
  mode: "flip",
  fastMode: false,
};

export const STUDY_PREFERENCES_VERSION = 2;

export function normalizeStoredStudyPreferences(value: unknown): StudyPreferences {
  const parsed = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const currentVersion = Number(parsed.version) >= STUDY_PREFERENCES_VERSION;
  const parsedDirection = typeof parsed.direction === "string" ? parsed.direction : "";

  return {
    favoritesOnly: typeof parsed.favoritesOnly === "boolean" ? parsed.favoritesOnly : DEFAULTS.favoritesOnly,
    order: parsed.order === "sequential" ? "sequential" : DEFAULTS.order,
    // Preferences saved before v2 often inherited a list's primary side without
    // an explicit student choice. Reset that legacy value to the global default.
    direction: currentVersion && ["a-b", "b-a", "any"].includes(parsedDirection)
      ? parsedDirection as Direction
      : DEFAULTS.direction,
    mode: typeof parsed.mode === "string" ? parsed.mode : DEFAULTS.mode,
    fastMode: typeof parsed.fastMode === "boolean" ? parsed.fastMode : DEFAULTS.fastMode,
  };
}

function storageKey(userId: string | undefined): string {
  return userId ? `studyPreferences:${userId}` : "studyPreferences:anon";
}

/**
 * Load preferences from localStorage, but let current URL params win
 * for mode/direction/order/favorites so links like ?mode=write always work.
 */
function load(userId: string | undefined): StudyPreferences {
  let base: StudyPreferences;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    base = raw ? normalizeStoredStudyPreferences(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    base = { ...DEFAULTS };
  }

  // URL params override localStorage at load time so deep-links always work
  try {
    const params = new URLSearchParams(window.location.search);

    const urlMode = params.get("mode");
    if (urlMode) base.mode = urlMode;

    const urlDir = params.get("dir") || params.get("direction");
    if (urlDir && ["a-b", "b-a", "any"].includes(urlDir)) {
      base.direction = urlDir as Direction;
    }

    const urlOrder = params.get("order");
    if (urlOrder === "sequential" || urlOrder === "random") {
      base.order = urlOrder;
    }

    const urlFav = params.get("favorites");
    if (urlFav === "true" || urlFav === "false") {
      base.favoritesOnly = urlFav === "true";
    }
  } catch {
    // URL parsing failed — use base as-is
  }

  return base;
}

function save(userId: string | undefined, prefs: StudyPreferences) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ version: STUDY_PREFERENCES_VERSION, ...prefs }));
  } catch {
    // storage full or unavailable — fail silently
  }
}

/**
 * Centralized, localStorage-backed study preferences.
 *
 * - Auto-loads on mount from `studyPreferences:<userId>`
 * - URL params override localStorage at load time (mode, dir, order, favorites)
 * - Auto-saves on every change
 */
export function useStudyPreferences(userId: string | undefined) {
  const [prefs, setPrefsState] = useState<StudyPreferences>(() => load(userId));
  const userIdRef = useRef(userId);

  // Reload when userId changes (e.g. auth loads after mount).
  // MERGE strategy: when transitioning anon → user, prefer the user's stored
  // settings if they exist, but if there are NONE, carry forward the anonymous
  // session's prefs so the user doesn't lose their just-made choices on login.
  //
  // CRITICAL: regardless of which source wins, the URL params (mode/dir/order/
  // favorites) ALWAYS override afterwards. This prevents stale user prefs
  // from a previous session from silently overriding the direction the user
  // just selected in GamesHub.
  useEffect(() => {
    if (userId !== userIdRef.current) {
      const previousAnonPrefs = userIdRef.current === undefined ? prefs : null;
      userIdRef.current = userId;
      const userHasStored = (() => {
        try { return localStorage.getItem(storageKey(userId)) !== null; }
        catch { return false; }
      })();
      // load(userId) already applies URL overrides. If we keep the anon
      // snapshot instead, re-apply URL overrides on top of it so the URL
      // remains the SSOT for this session.
      let next: StudyPreferences;
      if (userHasStored || !previousAnonPrefs) {
        next = load(userId);
      } else {
        next = { ...previousAnonPrefs };
        try {
          const params = new URLSearchParams(window.location.search);
          const urlMode = params.get("mode");
          if (urlMode) next.mode = urlMode;
          const urlDir = params.get("dir") || params.get("direction");
          if (urlDir && ["a-b", "b-a", "any"].includes(urlDir)) {
            next.direction = urlDir as Direction;
          }
          const urlOrder = params.get("order");
          if (urlOrder === "sequential" || urlOrder === "random") next.order = urlOrder;
          const urlFav = params.get("favorites");
          if (urlFav === "true" || urlFav === "false") next.favoritesOnly = urlFav === "true";
        } catch {
          // URL parsing failed — keep previous anon prefs
        }
      }
      setPrefsState(next);
      if (import.meta.env.DEV) {
        console.debug("[StudyPreferences] userId changed", {
          userId, userHasStored, mergedFromAnon: !userHasStored && !!previousAnonPrefs,
          finalDirection: next.direction, finalMode: next.mode,
        });
      }
    }
  }, [userId, prefs]);

  // Persist whenever prefs change
  useEffect(() => {
    save(userIdRef.current, prefs);
  }, [prefs]);

  const updatePrefs = useCallback((partial: Partial<StudyPreferences>) => {
    setPrefsState(prev => ({ ...prev, ...partial }));
  }, []);

  /**
   * @deprecated URL overrides are now applied inside load().
   * Kept for backward compatibility — calling it is a no-op.
   */
  const applyUrlOverrides = useCallback((_params: URLSearchParams) => {
    // no-op: URL overrides happen at load time now
  }, []);

  return { prefs, updatePrefs, applyUrlOverrides };
}
