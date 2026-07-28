/**
 * Compatibility facade for the original palette API.
 *
 * New code should consume `visualPreferences.ts` or `useVisualPreferences`.
 * Existing palette consumers keep the exact legacy behavior while the visual
 * system migrates incrementally.
 */

import {
  applyVisualPreferences,
  bootVisualPreferences,
  persistVisualPreferences,
  readVisualPreferences,
  withLegacyPaletteSelection,
  type PaletteId,
} from "@/lib/visualPreferences";

export {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  getPaletteMeta,
  isPaletteId,
  type PaletteId,
  type PaletteMeta,
} from "@/lib/visualPreferences";

export function readStoredPalette(): PaletteId {
  return readVisualPreferences().palette;
}

export function applyPalette(id: PaletteId): void {
  applyVisualPreferences(withLegacyPaletteSelection(readVisualPreferences(), id));
}

export function persistPalette(id: PaletteId): void {
  persistVisualPreferences(withLegacyPaletteSelection(readVisualPreferences(), id));
}

export function bootPalette(): PaletteId {
  return bootVisualPreferences().palette;
}
