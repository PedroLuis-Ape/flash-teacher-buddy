import { useCallback, useEffect, useState } from "react";
import {
  applyPalette,
  bootPalette,
  PALETTES,
  PaletteId,
  persistPalette,
} from "@/lib/palettes";

const PALETTE_CHANGE_EVENT = "ape:palette-change";

/**
 * usePalette — read/write the global APE palette.
 * Applies via `data-palette` attribute on <html>.
 */
export function usePalette() {
  const [palette, setPaletteState] = useState<PaletteId>(() => bootPalette());

  // Sync across tabs and between multiple hook instances in the same tab.
  useEffect(() => {
    const syncPalette = (next: unknown) => {
      if (typeof next !== "string") return;
      if (!PALETTES.some((candidate) => candidate.id === next)) return;
      const paletteId = next as PaletteId;
      applyPalette(paletteId);
      setPaletteState(paletteId);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "ape:palette" && event.newValue) {
        syncPalette(event.newValue);
      }
    };

    const onPaletteChange = (event: Event) => {
      syncPalette((event as CustomEvent<PaletteId>).detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(PALETTE_CHANGE_EVENT, onPaletteChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PALETTE_CHANGE_EVENT, onPaletteChange);
    };
  }, []);

  const setPalette = useCallback((id: PaletteId) => {
    applyPalette(id);
    persistPalette(id);
    setPaletteState(id);
    window.dispatchEvent(new CustomEvent<PaletteId>(PALETTE_CHANGE_EVENT, { detail: id }));
  }, []);

  return { palette, setPalette, palettes: PALETTES };
}
