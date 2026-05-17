/**
 * APE Palette System
 * --------------------------------------------------------------
 * Independent of light/dark theme. The palette controls the HSL
 * token values via `html[data-palette="..."]` attribute selectors
 * defined in src/index.css. Theme (light/dark) keeps working —
 * palettes simply override the relevant tokens.
 */

export type PaletteId = "classic" | "fresh" | "ocean";

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  description: string;
  /** Small swatch for the picker UI — 3 HSL strings */
  swatch: [string, string, string];
  /** Whether this palette is intended as light or dark base */
  base: "light" | "dark";
}

export const PALETTES: PaletteMeta[] = [
  {
    id: "classic",
    name: "APE Classic",
    description: "Roxo e violeta — a identidade original do APE.",
    swatch: ["268 78% 68%", "290 82% 70%", "258 30% 8%"],
    base: "dark",
  },
  {
    id: "fresh",
    name: "APE Fresh",
    description: "Claro e leve — verde educacional com apoio azul.",
    swatch: ["152 60% 42%", "200 75% 52%", "0 0% 100%"],
    base: "light",
  },
  {
    id: "ocean",
    name: "APE Ocean",
    description: "Escuro alternativo — ciano calmo com toque roxo.",
    swatch: ["190 80% 58%", "260 60% 65%", "215 40% 10%"],
    base: "dark",
  },
];

export const DEFAULT_PALETTE: PaletteId = "classic";
export const PALETTE_STORAGE_KEY = "ape:palette";

const VALID_IDS = new Set<PaletteId>(PALETTES.map((p) => p.id));

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && VALID_IDS.has(value as PaletteId);
}

/** Read persisted palette with safe fallback. */
export function readStoredPalette(): PaletteId {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (isPaletteId(raw)) return raw;
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_PALETTE;
}

/** Apply the palette to <html> and optionally align light/dark base. */
export function applyPalette(id: PaletteId): void {
  const root = document.documentElement;
  root.setAttribute("data-palette", id);
  const meta = PALETTES.find((p) => p.id === id);
  if (!meta) return;
  // Align theme base so paint matches palette intent.
  // We do NOT remove the user's previous theme preference (key "theme")
  // — only adjust the visual class. The theme toggle still works after.
  root.classList.remove(meta.base === "dark" ? "light" : "dark");
  root.classList.add(meta.base);
}

/** Persist palette choice (best-effort). */
export function persistPalette(id: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
    localStorage.setItem("theme", PALETTES.find((p) => p.id === id)?.base ?? "dark");
  } catch {
    /* noop */
  }
}

/** Convenience: read + apply on boot. */
export function bootPalette(): PaletteId {
  const id = readStoredPalette();
  applyPalette(id);
  return id;
}