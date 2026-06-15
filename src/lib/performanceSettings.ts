/**
 * Performance Settings Store
 *
 * Synchronous localStorage-based settings for performance/quality presets.
 */

const STORAGE_KEY = "ape-performance-settings";

export type PerformancePreset = "high" | "balanced" | "light";

export interface PerformanceSettings {
  preset: PerformancePreset;
  soundEffects: boolean;
  animations: boolean;
  hoverEffects: boolean;
  wordTooltips: boolean;
  decorativeEffects: boolean;
  visualFeedback: boolean;
  highQualityImages: boolean;
  prefetching: boolean;
  reduceMotion: boolean;
  tabBarAnimations: boolean;
  backdropBlur: boolean;
}

export const PRESET_HIGH: PerformanceSettings = {
  preset: "high",
  soundEffects: true,
  animations: true,
  hoverEffects: true,
  wordTooltips: true,
  decorativeEffects: true,
  visualFeedback: true,
  highQualityImages: true,
  prefetching: true,
  reduceMotion: false,
  tabBarAnimations: true,
  backdropBlur: true,
};

export const PRESET_BALANCED: PerformanceSettings = {
  preset: "balanced",
  soundEffects: true,
  animations: true,
  hoverEffects: true,
  wordTooltips: true,
  decorativeEffects: false,
  visualFeedback: true,
  highQualityImages: true,
  prefetching: false,
  reduceMotion: false,
  tabBarAnimations: true,
  backdropBlur: false,
};

export const PRESET_LIGHT: PerformanceSettings = {
  preset: "light",
  soundEffects: false,
  animations: false,
  hoverEffects: false,
  wordTooltips: false,
  decorativeEffects: false,
  visualFeedback: false,
  highQualityImages: false,
  prefetching: false,
  reduceMotion: true,
  tabBarAnimations: false,
  backdropBlur: false,
};

export const PRESETS: Record<PerformancePreset, PerformanceSettings> = {
  high: PRESET_HIGH,
  balanced: PRESET_BALANCED,
  light: PRESET_LIGHT,
};

function shouldPreferBalanced(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(max-width: 767px), (pointer: coarse), (update: slow)").matches;
}

export function getRecommendedPerformanceSettings(): PerformanceSettings {
  return { ...(shouldPreferBalanced() ? PRESET_BALANCED : PRESET_HIGH) };
}

export function readPerformanceSettings(): PerformanceSettings {
  if (typeof window === "undefined") return { ...PRESET_BALANCED };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getRecommendedPerformanceSettings();
    const parsed = JSON.parse(raw) as Partial<PerformanceSettings>;
    return { ...getRecommendedPerformanceSettings(), ...parsed };
  } catch {
    return getRecommendedPerformanceSettings();
  }
}

export function writePerformanceSettings(settings: PerformanceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best effort only.
  }
}

export function detectPreset(settings: PerformanceSettings): PerformancePreset | "custom" {
  for (const [key, preset] of Object.entries(PRESETS) as [PerformancePreset, PerformanceSettings][]) {
    const match = (Object.keys(preset) as (keyof PerformanceSettings)[])
      .filter((settingKey) => settingKey !== "preset")
      .every((settingKey) => settings[settingKey] === preset[settingKey]);
    if (match) return key;
  }
  return "custom";
}

let cachedSettings: PerformanceSettings | null = null;

export function getPerfSettings(): PerformanceSettings {
  if (!cachedSettings) cachedSettings = readPerformanceSettings();
  return cachedSettings;
}

export function updatePerfSettingsCache(settings: PerformanceSettings): void {
  cachedSettings = settings;
}
