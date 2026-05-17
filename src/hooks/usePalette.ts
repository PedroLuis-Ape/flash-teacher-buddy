import { useCallback, useEffect, useState } from "react";
import {
  applyPalette,
  bootPalette,
  PALETTES,
  PaletteId,
  persistPalette,
} from "@/lib/palettes";

/**
 * usePalette — read/write the global APE palette.
 * Applies via `data-palette` attribute on <html>.
 */
export function usePalette() {
  const [palette, setPaletteState] = useState<PaletteId>(() => bootPalette());

  // Sync across tabs / external changes.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "ape:palette" || !e.newValue) return;
      const next = e.newValue as PaletteId;
      if (next !== palette && PALETTES.some((p) => p.id === next)) {
        applyPalette(next);
        setPaletteState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [palette]);

  const setPalette = useCallback((id: PaletteId) => {
    applyPalette(id);
    persistPalette(id);
    setPaletteState(id);
  }, []);

  return { palette, setPalette, palettes: PALETTES };
}