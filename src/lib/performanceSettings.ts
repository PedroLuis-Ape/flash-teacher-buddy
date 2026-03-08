/**
 * Performance Settings Store
 * 
 * Synchronous localStorage-based settings for performance/quality presets.
 * Reads BEFORE React renders to avoid flash of wrong settings.
 */

const STORAGE_KEY = 'ape-performance-settings';

export type PerformancePreset = 'high' | 'balanced' | 'light';

export interface PerformanceSettings {
  preset: PerformancePreset;
  /** Sound effects in study games */
  soundEffects: boolean;
  /** Page transition animations (fade/scale) */
  animations: boolean;
  /** Hover effects on cards and interactive elements */
  hoverEffects: boolean;
  /** Word-level tooltips in study views */
  wordTooltips: boolean;
  /** Decorative visual effects (glow, gradients, blur) */
  decorativeEffects: boolean;
  /** Advanced visual feedback (scale on press, ripples) */
  visualFeedback: boolean;
  /** High quality images vs optimized/compressed */
  highQualityImages: boolean;
  /** Aggressive prefetching of routes/data */
  prefetching: boolean;
  /** Reduce motion (respects OS preference too) */
  reduceMotion: boolean;
  /** Tab bar animated indicator */
  tabBarAnimations: boolean;
  /** Backdrop blur effects */
  backdropBlur: boolean;
}

export const PRESET_HIGH: PerformanceSettings = {
  preset: 'high',
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
  preset: 'balanced',
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
  preset: 'light',
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

/** Read settings synchronously from localStorage — safe to call before React mounts */
export function readPerformanceSettings(): PerformanceSettings {
  if (typeof window === 'undefined') return PRESET_HIGH;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PRESET_HIGH;
    const parsed = JSON.parse(raw) as Partial<PerformanceSettings>;
    // Merge with defaults to handle new keys added in future versions
    return { ...PRESET_HIGH, ...parsed };
  } catch {
    return PRESET_HIGH;
  }
}

/** Write settings to localStorage */
export function writePerformanceSettings(settings: PerformanceSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // quota exceeded — silently fail
  }
}

/** Detect which preset matches the current toggles, or 'custom' */
export function detectPreset(settings: PerformanceSettings): PerformancePreset | 'custom' {
  for (const [key, preset] of Object.entries(PRESETS) as [PerformancePreset, PerformanceSettings][]) {
    const match = (Object.keys(preset) as (keyof PerformanceSettings)[])
      .filter(k => k !== 'preset')
      .every(k => settings[k] === preset[k]);
    if (match) return key;
  }
  return 'custom';
}

// ── Global synchronous getter (for non-React code like sfx.ts) ──
let _cached: PerformanceSettings | null = null;

export function getPerfSettings(): PerformanceSettings {
  if (!_cached) _cached = readPerformanceSettings();
  return _cached;
}

/** Called by context when settings change, so global getter stays in sync */
export function updatePerfSettingsCache(s: PerformanceSettings): void {
  _cached = s;
}
