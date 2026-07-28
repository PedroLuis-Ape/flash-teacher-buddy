import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyVisualPreferences,
  bootVisualPreferences,
  isAppearance,
  isPaletteId,
  normalizeVisualPreferences,
  parseVisualPreferences,
  persistVisualPreferences,
  resolveAppearance,
  VISUAL_PREFERENCES_CHANGE_EVENT,
  VISUAL_PREFERENCES_STORAGE_KEY,
  PALETTE_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  withAppearance,
  withLegacyPaletteSelection,
  withPalette,
  withVisualStyle,
  type Appearance,
  type PaletteId,
  type VisualPreferencesV1,
  type VisualStyle,
} from "@/lib/visualPreferences";

function dispatchPreferences(preferences: VisualPreferencesV1): void {
  window.dispatchEvent(
    new CustomEvent<VisualPreferencesV1>(VISUAL_PREFERENCES_CHANGE_EVENT, {
      detail: preferences,
    }),
  );
}

export function useVisualPreferences() {
  const [preferences, setPreferencesState] = useState<VisualPreferencesV1>(
    () => bootVisualPreferences(),
  );
  const preferencesRef = useRef(preferences);

  const syncPreferences = useCallback((next: VisualPreferencesV1) => {
    preferencesRef.current = next;
    applyVisualPreferences(next);
    setPreferencesState(next);
  }, []);

  const commitPreferences = useCallback(
    (next: VisualPreferencesV1) => {
      preferencesRef.current = next;
      applyVisualPreferences(next);
      persistVisualPreferences(next);
      setPreferencesState(next);
      dispatchPreferences(next);
    },
    [],
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === VISUAL_PREFERENCES_STORAGE_KEY) {
        const parsed = parseVisualPreferences(event.newValue);
        if (parsed) syncPreferences(parsed);
        return;
      }

      if (event.key === PALETTE_STORAGE_KEY && isPaletteId(event.newValue)) {
        const canonical = parseVisualPreferences(
          localStorage.getItem(VISUAL_PREFERENCES_STORAGE_KEY),
        );
        if (canonical?.palette === event.newValue) {
          syncPreferences(canonical);
          return;
        }
        syncPreferences(
          withLegacyPaletteSelection(preferencesRef.current, event.newValue),
        );
        return;
      }

      if (event.key === LEGACY_THEME_STORAGE_KEY && isAppearance(event.newValue)) {
        const canonical = parseVisualPreferences(
          localStorage.getItem(VISUAL_PREFERENCES_STORAGE_KEY),
        );
        if (canonical && resolveAppearance(canonical.appearance) === event.newValue) {
          syncPreferences(canonical);
          return;
        }
        syncPreferences(withAppearance(preferencesRef.current, event.newValue));
      }
    };

    const onPreferencesChange = (event: Event) => {
      const detail = (event as CustomEvent<VisualPreferencesV1>).detail;
      if (!detail || detail.version !== 1) return;
      syncPreferences(normalizeVisualPreferences(detail));
    };

    const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemAppearanceChange = () => {
      if (preferencesRef.current.appearance !== "system") return;
      applyVisualPreferences(preferencesRef.current);
      setPreferencesState({ ...preferencesRef.current });
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(VISUAL_PREFERENCES_CHANGE_EVENT, onPreferencesChange);
    colorScheme.addEventListener?.("change", onSystemAppearanceChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(VISUAL_PREFERENCES_CHANGE_EVENT, onPreferencesChange);
      colorScheme.removeEventListener?.("change", onSystemAppearanceChange);
    };
  }, [syncPreferences]);

  const setAppearance = useCallback(
    (appearance: Appearance) => {
      commitPreferences(withAppearance(preferencesRef.current, appearance));
    },
    [commitPreferences],
  );

  const setVisualStyle = useCallback(
    (visualStyle: VisualStyle) => {
      commitPreferences(withVisualStyle(preferencesRef.current, visualStyle));
    },
    [commitPreferences],
  );

  const setPalette = useCallback(
    (palette: PaletteId) => {
      commitPreferences(withPalette(preferencesRef.current, palette));
    },
    [commitPreferences],
  );

  const setLegacyPalette = useCallback(
    (palette: PaletteId) => {
      commitPreferences(
        withLegacyPaletteSelection(preferencesRef.current, palette),
      );
    },
    [commitPreferences],
  );

  return {
    preferences,
    appearance: preferences.appearance,
    resolvedAppearance: resolveAppearance(preferences.appearance),
    visualStyle: preferences.visualStyle,
    palette: preferences.palette,
    setAppearance,
    setVisualStyle,
    setPalette,
    setLegacyPalette,
  };
}
