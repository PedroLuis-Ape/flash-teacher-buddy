/**
 * PerformanceContext — provides performance settings to the entire app.
 * Reads from localStorage synchronously on init (no flash of wrong state).
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  type PerformanceSettings,
  type PerformancePreset,
  PRESETS,
  PRESET_HIGH,
  readPerformanceSettings,
  writePerformanceSettings,
  detectPreset,
  updatePerfSettingsCache,
} from '@/lib/performanceSettings';

interface PerformanceContextValue {
  settings: PerformanceSettings;
  /** Apply a full preset */
  applyPreset: (preset: PerformancePreset) => void;
  /** Toggle a single setting */
  toggleSetting: (key: keyof Omit<PerformanceSettings, 'preset'>, value: boolean) => void;
  /** Apply a full settings object */
  applySettings: (s: PerformanceSettings) => void;
  /** Reset to default (High) */
  resetToDefault: () => void;
  /** Detected preset name or 'custom' */
  currentPreset: PerformancePreset | 'custom';
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PerformanceSettings>(() => readPerformanceSettings());

  const persist = useCallback((s: PerformanceSettings) => {
    setSettings(s);
    writePerformanceSettings(s);
    updatePerfSettingsCache(s);
  }, []);

  const applyPreset = useCallback((preset: PerformancePreset) => {
    persist({ ...PRESETS[preset] });
  }, [persist]);

  const toggleSetting = useCallback((key: keyof Omit<PerformanceSettings, 'preset'>, value: boolean) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      next.preset = detectPreset(next) as PerformancePreset;
      writePerformanceSettings(next);
      updatePerfSettingsCache(next);
      return next;
    });
  }, []);

  const applySettings = useCallback((s: PerformanceSettings) => {
    persist(s);
  }, [persist]);

  const resetToDefault = useCallback(() => {
    persist({ ...PRESET_HIGH });
  }, [persist]);

  const currentPreset = detectPreset(settings);

  // Keep CSS performance switches deterministic and in sync with both the
  // selected preset and the operating-system reduced-motion preference.
  useEffect(() => {
    const el = document.documentElement;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const syncFlags = () => {
      const motionAllowed = settings.animations && !settings.reduceMotion && !media.matches;

      el.toggleAttribute('data-perf-no-anim', !motionAllowed);
      el.toggleAttribute('data-perf-no-hover', !settings.hoverEffects);
      el.toggleAttribute('data-perf-no-decor', !settings.decorativeEffects);
      el.toggleAttribute('data-perf-space-stars', motionAllowed);
      el.toggleAttribute('data-perf-backdrop', settings.backdropBlur);
    };

    syncFlags();
    media.addEventListener?.('change', syncFlags);
    return () => media.removeEventListener?.('change', syncFlags);
  }, [
    settings.animations,
    settings.reduceMotion,
    settings.hoverEffects,
    settings.decorativeEffects,
    settings.backdropBlur,
  ]);

  const contextValue = useMemo(() => ({
    settings, applyPreset, toggleSetting, applySettings, resetToDefault, currentPreset,
  }), [settings, applyPreset, toggleSetting, applySettings, resetToDefault, currentPreset]);

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance(): PerformanceContextValue {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error('usePerformance must be used within PerformanceProvider');
  return ctx;
}
