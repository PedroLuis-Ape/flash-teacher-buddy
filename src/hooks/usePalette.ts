import { PALETTES } from "@/lib/palettes";
import { useVisualPreferences } from "@/hooks/useVisualPreferences";

/**
 * usePalette — read/write the global APE palette.
 * Applies via `data-palette` attribute on <html>.
 */
export function usePalette() {
  const { palette, setLegacyPalette } = useVisualPreferences();

  return { palette, setPalette: setLegacyPalette, palettes: PALETTES };
}
