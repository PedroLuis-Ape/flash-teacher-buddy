/**
 * Versioned visual preference contract.
 *
 * This is intentionally local-only. The project has no audited user preference
 * table yet, so cross-device sync must not be implied or simulated.
 */

export type Appearance = "light" | "dark" | "system";
export type ResolvedAppearance = Exclude<Appearance, "system">;
export type VisualStyle = "classic" | "galaxy" | "playful";
export type PaletteId = "black" | "green" | "white" | "galaxy";

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  shortName: string;
  description: string;
  swatch: [string, string, string];
  base: ResolvedAppearance;
  special?: boolean;
  performanceHint?: string;
}

export interface VisualPreferencesV1 {
  version: 1;
  appearance: Appearance;
  visualStyle: VisualStyle;
  palette: PaletteId;
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
export const DEFAULT_VISUAL_PREFERENCES: VisualPreferencesV1 = {
  version: 1,
  appearance: "dark",
  visualStyle: "classic",
  palette: DEFAULT_PALETTE,
};

export const VISUAL_PREFERENCES_STORAGE_KEY = "ape:visual-preferences:v1";
export const PALETTE_STORAGE_KEY = "ape:palette";
export const LEGACY_THEME_STORAGE_KEY = "theme";
export const VISUAL_PREFERENCES_CHANGE_EVENT = "ape:visual-preferences-change";

const VALID_PALETTES = new Set<PaletteId>(PALETTES.map((palette) => palette.id));
const VALID_APPEARANCES = new Set<Appearance>(["light", "dark", "system"]);
const VALID_VISUAL_STYLES = new Set<VisualStyle>(["classic", "galaxy", "playful"]);

const LEGACY_PALETTE_MAP: Record<string, PaletteId> = {
  classic: "black",
  fresh: "green",
  ocean: "black",
};

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && VALID_PALETTES.has(value as PaletteId);
}

export function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && VALID_APPEARANCES.has(value as Appearance);
}

export function isVisualStyle(value: unknown): value is VisualStyle {
  return typeof value === "string" && VALID_VISUAL_STYLES.has(value as VisualStyle);
}

export function getPaletteMeta(id: PaletteId): PaletteMeta {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

function normalizeLegacyPalette(value: unknown): PaletteId {
  if (isPaletteId(value)) return value;
  if (typeof value === "string" && LEGACY_PALETTE_MAP[value]) {
    return LEGACY_PALETTE_MAP[value];
  }
  return DEFAULT_PALETTE;
}

/**
 * Galaxy remains a constrained legacy family until its color tokens stop being
 * keyed directly by `data-palette="galaxy"`. The constraint prevents broken
 * light/green/white combinations during the incremental migration.
 */
export function normalizeVisualPreferences(
  candidate: Partial<VisualPreferencesV1> | null | undefined,
): VisualPreferencesV1 {
  let palette = isPaletteId(candidate?.palette)
    ? candidate.palette
    : DEFAULT_VISUAL_PREFERENCES.palette;
  let visualStyle = isVisualStyle(candidate?.visualStyle)
    ? candidate.visualStyle
    : palette === "galaxy"
      ? "galaxy"
      : DEFAULT_VISUAL_PREFERENCES.visualStyle;
  let appearance = isAppearance(candidate?.appearance)
    ? candidate.appearance
    : getPaletteMeta(palette).base;

  if (palette === "galaxy" || visualStyle === "galaxy") {
    palette = "galaxy";
    visualStyle = "galaxy";
    appearance = "dark";
  }

  return {
    version: 1,
    appearance,
    visualStyle,
    palette,
  };
}

export function migrateLegacyVisualPreferences(
  legacyPalette: unknown,
  legacyTheme: unknown,
): VisualPreferencesV1 {
  const palette = normalizeLegacyPalette(legacyPalette);
  const appearance = isAppearance(legacyTheme) ? legacyTheme : getPaletteMeta(palette).base;
  return normalizeVisualPreferences({
    version: 1,
    appearance,
    visualStyle: palette === "galaxy" ? "galaxy" : "classic",
    palette,
  });
}

export function parseVisualPreferences(raw: string | null): VisualPreferencesV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VisualPreferencesV1> | null;
    if (!parsed || parsed.version !== 1) return null;
    return normalizeVisualPreferences(parsed);
  } catch {
    return null;
  }
}

export function readVisualPreferences(): VisualPreferencesV1 {
  try {
    const stored = parseVisualPreferences(localStorage.getItem(VISUAL_PREFERENCES_STORAGE_KEY));
    if (stored) return stored;

    const migrated = migrateLegacyVisualPreferences(
      localStorage.getItem(PALETTE_STORAGE_KEY),
      localStorage.getItem(LEGACY_THEME_STORAGE_KEY),
    );
    persistVisualPreferences(migrated);
    return migrated;
  } catch {
    return DEFAULT_VISUAL_PREFERENCES;
  }
}

export function resolveAppearance(appearance: Appearance): ResolvedAppearance {
  if (appearance !== "system") return appearance;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyVisualPreferences(preferences: VisualPreferencesV1): void {
  const normalized = normalizeVisualPreferences(preferences);
  const resolvedAppearance = resolveAppearance(normalized.appearance);
  const root = document.documentElement;

  root.setAttribute("data-visual-preferences-version", String(normalized.version));
  root.setAttribute("data-appearance", normalized.appearance);
  root.setAttribute("data-resolved-appearance", resolvedAppearance);
  root.setAttribute("data-visual-style", normalized.visualStyle);
  root.setAttribute("data-palette", normalized.palette);
  root.toggleAttribute("data-layout-special", normalized.visualStyle === "galaxy");
  root.classList.remove("light", "dark");
  root.classList.add(resolvedAppearance);
  root.style.colorScheme = resolvedAppearance;
  root.style.backgroundColor =
    resolvedAppearance === "dark" ? "hsl(224 71% 4%)" : "hsl(0 0% 100%)";
}

export function persistVisualPreferences(preferences: VisualPreferencesV1): void {
  const normalized = normalizeVisualPreferences(preferences);
  const resolvedAppearance = resolveAppearance(normalized.appearance);
  try {
    localStorage.setItem(VISUAL_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    // Compatibility writes keep rollback and older builds safe.
    localStorage.setItem(PALETTE_STORAGE_KEY, normalized.palette);
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, resolvedAppearance);
  } catch {
    // Best effort only in privacy-restricted contexts.
  }
}

export function withAppearance(
  current: VisualPreferencesV1,
  appearance: Appearance,
): VisualPreferencesV1 {
  return normalizeVisualPreferences({ ...current, appearance });
}

export function withVisualStyle(
  current: VisualPreferencesV1,
  visualStyle: VisualStyle,
): VisualPreferencesV1 {
  const palette =
    visualStyle === "galaxy"
      ? "galaxy"
      : current.palette === "galaxy"
        ? DEFAULT_PALETTE
        : current.palette;
  return normalizeVisualPreferences({ ...current, palette, visualStyle });
}

export function withPalette(
  current: VisualPreferencesV1,
  palette: PaletteId,
): VisualPreferencesV1 {
  const visualStyle =
    palette === "galaxy"
      ? "galaxy"
      : current.visualStyle === "galaxy"
        ? "classic"
        : current.visualStyle;
  return normalizeVisualPreferences({ ...current, palette, visualStyle });
}

export function withLegacyPaletteSelection(
  current: VisualPreferencesV1,
  palette: PaletteId,
): VisualPreferencesV1 {
  return normalizeVisualPreferences({
    ...withPalette(current, palette),
    appearance: getPaletteMeta(palette).base,
  });
}

export function bootVisualPreferences(): VisualPreferencesV1 {
  const preferences = readVisualPreferences();
  applyVisualPreferences(preferences);
  return preferences;
}
