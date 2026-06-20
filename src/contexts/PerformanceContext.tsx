/**
 * PerformanceContext — provides performance settings to the entire app.
 * Reads from localStorage synchronously on init (no flash of wrong state).
 */
import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  type BooleanPerformanceSettingKey,
  type GalaxyVisualQuality,
  type PerformanceSettings,
  type PerformancePreset,
  PRESETS,
  readPerformanceSettings,
  writePerformanceSettings,
  detectPreset,
  updatePerfSettingsCache,
  getRecommendedPerformanceSettings,
} from '@/lib/performanceSettings';

interface PerformanceContextValue {
  settings: PerformanceSettings;
  applyPreset: (preset: PerformancePreset) => void;
  toggleSetting: (key: BooleanPerformanceSettingKey, value: boolean) => void;
  setGalaxyQuality: (quality: GalaxyVisualQuality) => void;
  applySettings: (s: PerformanceSettings) => void;
  resetToDefault: () => void;
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
    setSettings((current) => {
      const next = { ...PRESETS[preset], galaxyQuality: current.galaxyQuality };
      writePerformanceSettings(next);
      updatePerfSettingsCache(next);
      return next;
    });
  }, []);

  const toggleSetting = useCallback((key: BooleanPerformanceSettingKey, value: boolean) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      next.preset = detectPreset(next) as PerformancePreset;
      writePerformanceSettings(next);
      updatePerfSettingsCache(next);
      return next;
    });
  }, []);

  const setGalaxyQuality = useCallback((quality: GalaxyVisualQuality) => {
    setSettings((current) => {
      const next = { ...current, galaxyQuality: quality };
      writePerformanceSettings(next);
      updatePerfSettingsCache(next);
      return next;
    });
  }, []);

  const applySettings = useCallback((s: PerformanceSettings) => {
    persist(s);
  }, [persist]);

  const resetToDefault = useCallback(() => {
    persist(getRecommendedPerformanceSettings());
  }, [persist]);

  const currentPreset = detectPreset(settings);

  useEffect(() => {
    const el = document.documentElement;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const syncFlags = () => {
      const motionAllowed = settings.animations && !settings.reduceMotion && !media.matches;
      el.toggleAttribute('data-perf-no-anim', !motionAllowed);
      el.toggleAttribute('data-perf-no-hover', !settings.hoverEffects);
      el.toggleAttribute('data-perf-no-decor', !settings.decorativeEffects);
      el.toggleAttribute('data-perf-space-stars', motionAllowed && settings.decorativeEffects);
      el.toggleAttribute('data-perf-backdrop', settings.backdropBlur);
      el.setAttribute('data-galaxy-quality', settings.galaxyQuality);
    };

    syncFlags();
    media.addEventListener?.('change', syncFlags);
    return () => media.removeEventListener?.('change', syncFlags);
  }, [settings.animations, settings.reduceMotion, settings.hoverEffects, settings.decorativeEffects, settings.backdropBlur, settings.galaxyQuality]);

  const contextValue = useMemo(() => ({
    settings, applyPreset, toggleSetting, setGalaxyQuality, applySettings, resetToDefault, currentPreset,
  }), [settings, applyPreset, toggleSetting, setGalaxyQuality, applySettings, resetToDefault, currentPreset]);

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
