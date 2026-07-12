import type { GalaxyVisualQuality } from './performanceSettings';

export type GalaxyMotionTier = 'full' | 'balanced' | 'static';

export interface GalaxyCapabilitySnapshot {
  viewportWidth: number;
  reducedMotion: boolean;
  slowUpdate: boolean;
  coarsePointer: boolean;
  saveData: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface GalaxyCometPlan {
  count: 0 | 1 | 4;
  firstDelayMin: number;
  firstDelayVariation: number;
  repeatDelayMin: number;
  repeatDelayVariation: number;
  duration: number;
  staggerDelays: readonly number[];
}

export interface GalaxyScenePlan {
  nebula: boolean;
  dust: boolean;
  spiralMain: boolean;
  spiralDistant: boolean;
  planet: boolean;
  moon: boolean;
  animated: boolean;
}

const STATIC_MAX_WIDTH = 767;
const BALANCED_MAX_WIDTH = 1199;
const BALANCED_COMET_REPEAT_MIN = 55_000;
const BALANCED_COMET_REPEAT_VARIATION = 35_000;
const FULL_COMET_REPEAT_MIN = 40_000;
const FULL_COMET_REPEAT_VARIATION = 30_000;

export function chooseGalaxyMotionTier(snapshot: GalaxyCapabilitySnapshot): GalaxyMotionTier {
  const lowMemory = snapshot.deviceMemory !== undefined && snapshot.deviceMemory <= 4;
  const lowCpu = snapshot.hardwareConcurrency !== undefined && snapshot.hardwareConcurrency <= 4;

  if (
    snapshot.viewportWidth <= STATIC_MAX_WIDTH
    || snapshot.reducedMotion
    || snapshot.slowUpdate
    || snapshot.saveData
    || lowMemory
    || lowCpu
  ) {
    return 'static';
  }

  const mediumMemory = snapshot.deviceMemory !== undefined && snapshot.deviceMemory <= 6;
  const mediumCpu = snapshot.hardwareConcurrency !== undefined && snapshot.hardwareConcurrency <= 6;

  if (
    snapshot.viewportWidth <= BALANCED_MAX_WIDTH
    || snapshot.coarsePointer
    || mediumMemory
    || mediumCpu
  ) {
    return 'balanced';
  }

  return 'full';
}

export function getGalaxyStarLimit(
  tier: GalaxyMotionTier,
  quality: GalaxyVisualQuality = 'standard',
): number {
  if (tier === 'static') return 4;
  if (tier === 'balanced') return quality === 'high' ? 10 : 7;
  return quality === 'high' ? 16 : 10;
}

export function getGalaxyScenePlan(tier: GalaxyMotionTier): GalaxyScenePlan {
  if (tier === 'static') {
    return {
      nebula: false,
      dust: false,
      spiralMain: false,
      spiralDistant: false,
      planet: false,
      moon: false,
      animated: false,
    };
  }

  if (tier === 'balanced') {
    return {
      nebula: true,
      dust: false,
      spiralMain: true,
      spiralDistant: false,
      planet: true,
      moon: false,
      animated: false,
    };
  }

  return {
    nebula: true,
    dust: true,
    spiralMain: true,
    spiralDistant: true,
    planet: true,
    moon: true,
    animated: true,
  };
}

export function getGalaxyCometPlan(
  tier: GalaxyMotionTier,
  quality: GalaxyVisualQuality = 'standard',
): GalaxyCometPlan {
  if (tier === 'static') {
    return {
      count: 0,
      firstDelayMin: 0,
      firstDelayVariation: 0,
      repeatDelayMin: 0,
      repeatDelayVariation: 0,
      duration: 0,
      staggerDelays: [],
    };
  }

  if (tier === 'balanced') {
    return {
      count: 1,
      firstDelayMin: quality === 'high' ? 10_000 : 12_000,
      firstDelayVariation: quality === 'high' ? 6_000 : 8_000,
      repeatDelayMin: BALANCED_COMET_REPEAT_MIN,
      repeatDelayVariation: BALANCED_COMET_REPEAT_VARIATION,
      duration: quality === 'high' ? 6_400 : 6_000,
      staggerDelays: [0],
    };
  }

  return {
    count: 4,
    firstDelayMin: quality === 'high' ? 6_000 : 8_000,
    firstDelayVariation: quality === 'high' ? 4_000 : 6_000,
    repeatDelayMin: FULL_COMET_REPEAT_MIN,
    repeatDelayVariation: FULL_COMET_REPEAT_VARIATION,
    duration: quality === 'high' ? 6_800 : 7_200,
    staggerDelays: quality === 'high' ? [0, 850, 1_850, 3_100] : [0, 1_250, 2_650, 4_200],
  };
}

interface NavigatorWithPerformanceHints extends Navigator {
  deviceMemory?: number;
  connection?: EventTarget & { saveData?: boolean };
}

export function readGalaxyCapabilitySnapshot(): GalaxyCapabilitySnapshot {
  if (typeof window === 'undefined') {
    return {
      viewportWidth: 0,
      reducedMotion: true,
      slowUpdate: true,
      coarsePointer: true,
      saveData: true,
    };
  }

  const navigatorWithHints = navigator as NavigatorWithPerformanceHints;

  return {
    viewportWidth: window.innerWidth,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    slowUpdate: window.matchMedia('(update: slow)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: Boolean(navigatorWithHints.connection?.saveData),
    deviceMemory: navigatorWithHints.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
  };
}

export function detectGalaxyMotionTier(): GalaxyMotionTier {
  return chooseGalaxyMotionTier(readGalaxyCapabilitySnapshot());
}
