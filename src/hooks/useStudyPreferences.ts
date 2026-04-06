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

function storageKey(userId: string | undefined): string {
  return userId ? `studyPreferences:${userId}` : "studyPreferences:anon";
}

function load(userId: string | undefined): StudyPreferences {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    // Validate shape — accept only known keys
    return {
      favoritesOnly: typeof parsed.favoritesOnly === "boolean" ? parsed.favoritesOnly : DEFAULTS.favoritesOnly,
      order: parsed.order === "sequential" ? "sequential" : "random",
      direction: ["a-b", "b-a", "any"].includes(parsed.direction) ? parsed.direction : DEFAULTS.direction,
      mode: typeof parsed.mode === "string" ? parsed.mode : DEFAULTS.mode,
      fastMode: typeof parsed.fastMode === "boolean" ? parsed.fastMode : DEFAULTS.fastMode,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(userId: string | undefined, prefs: StudyPreferences) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // storage full or unavailable — fail silently
  }
}

/**
 * Centralized, localStorage-backed study preferences.
 *
 * - Auto-loads on mount from `studyPreferences:<userId>`
 * - Auto-saves on every change
 * - URL params can override on initial load via `applyUrlOverrides`
 */
export function useStudyPreferences(userId: string | undefined) {
  const [prefs, setPrefsState] = useState<StudyPreferences>(() => load(userId));
  const userIdRef = useRef(userId);

  // Reload when userId changes (e.g. auth loads after mount)
  useEffect(() => {
    if (userId !== userIdRef.current) {
      userIdRef.current = userId;
      setPrefsState(load(userId));
    }
  }, [userId]);

  // Persist whenever prefs change
  useEffect(() => {
    save(userIdRef.current, prefs);
  }, [prefs]);

  const updatePrefs = useCallback((partial: Partial<StudyPreferences>) => {
    setPrefsState(prev => ({ ...prev, ...partial }));
  }, []);

  /**
   * Apply URL search params as one-time overrides.
   * Call once on Study mount — URL wins over persisted when present.
   */
  const applyUrlOverrides = useCallback((params: URLSearchParams) => {
    const overrides: Partial<StudyPreferences> = {};
    let changed = false;

    const urlMode = params.get("mode");
    if (urlMode) { overrides.mode = urlMode; changed = true; }

    const urlDir = params.get("dir") || params.get("direction");
    if (urlDir && ["a-b", "b-a", "any"].includes(urlDir)) {
      overrides.direction = urlDir as Direction;
      changed = true;
    }

    const urlOrder = params.get("order");
    if (urlOrder === "sequential" || urlOrder === "random") {
      overrides.order = urlOrder;
      changed = true;
    }

    const urlFav = params.get("favorites");
    if (urlFav === "true" || urlFav === "false") {
      overrides.favoritesOnly = urlFav === "true";
      changed = true;
    }

    if (changed) {
      setPrefsState(prev => {
        const next = { ...prev, ...overrides };
        save(userIdRef.current, next);
        return next;
      });
    }
  }, []);

  return { prefs, updatePrefs, applyUrlOverrides };
}
