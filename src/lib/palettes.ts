/**
 * APE layout / palette system.
 *
 * Layouts are applied through `html[data-palette="..."]` and persist locally.
 * The galaxy layout is intentionally marked as special because it enables the
 * optional animated space layer. Standard layouts stay lightweight.
 */

export type PaletteId = "black" | "green" | "white" | "galaxy";

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  shortName: string;
  description: string;
  swatch: [string, string, string];
  base: "light" | "dark";
  special?: boolean;
  performanceHint?: string;
}

export const PALETTES: PaletteMeta[] = [
  {
    id: "black",
    name: "APE Preto",
    shortName: "Preto",
    description: "Escuro, sóbrio e leve. Recomendado para uso diário.",
    swatch: ["0 0% 7%", "258 18% 14%", "264 55% 62%"],
    base: "dark",
  },
  {
    id: "green",
    name: "APE Verde",
    shortName: "Verde",
    description: "Visual educacional em verde, claro e confortável.",
    swatch: ["156 52% 34%", "195 55% 46%", "140 18% 95%"],
    base: "light",
  },
  {
    id: "white",
    name: "APE Branco",
    shortName: "Branco",
    description: "Interface branca, limpa e com o menor custo visual.",
    swatch: ["0 0% 100%", "220 20% 94%", "262 60% 58%"],
    base: "light",
  },
  {
    id: "galaxy",
    name: "APE Galáxia",
    shortName: "Galáxia",
    description: "Nebulosas, braço galáctico e estrelas ocasionais.",
    swatch: ["248 52% 6%", "267 92% 66%", "292 86% 64%"],
    base: "dark",
    special: true,
    performanceHint: "Mais pesado. No celular, use o preset Equilibrado.",
  },
];

export const DEFAULT_PALETTE: PaletteId = "black";
export const PALETTE_STORAGE_KEY = "ape:palette";

const VALID_IDS = new Set<PaletteId>(PALETTES.map((palette) => palette.id));

const LEGACY_PALETTE_MAP: Record<string, PaletteId> = {
  classic: "black",
  fresh: "green",
  ocean: "black",
};

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && VALID_IDS.has(value as PaletteId);
}

export function readStoredPalette(): PaletteId {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (isPaletteId(raw)) return raw;
    if (raw && LEGACY_PALETTE_MAP[raw]) {
      const migrated = LEGACY_PALETTE_MAP[raw];
      localStorage.setItem(PALETTE_STORAGE_KEY, migrated);
      return migrated;
    }
  } catch {
    // localStorage can be unavailable in privacy-restricted contexts.
  }
  return DEFAULT_PALETTE;
}

export function applyPalette(id: PaletteId): void {
  const root = document.documentElement;
  const meta = PALETTES.find((palette) => palette.id === id);
  if (!meta) return;

  root.setAttribute("data-palette", id);
  root.toggleAttribute("data-layout-special", Boolean(meta.special));
  root.classList.remove(meta.base === "dark" ? "light" : "dark");
  root.classList.add(meta.base);
}

export function persistPalette(id: PaletteId): void {
  try {
    const meta = PALETTES.find((palette) => palette.id === id);
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
    localStorage.setItem("theme", meta?.base ?? "dark");
  } catch {
    // Best effort only.
  }
}

export function bootPalette(): PaletteId {
  const id = readStoredPalette();
  applyPalette(id);
  return id;
}
