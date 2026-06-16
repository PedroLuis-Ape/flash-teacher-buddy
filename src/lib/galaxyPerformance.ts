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

export interface ShootingStarTiming {
  firstDelayMin: number;
  firstDelayVariation: number;
  repeatDelayMin: number;
  repeatDelayVariation: number;
  duration: number;
}

const STATIC_MAX_WIDTH = 767;
const BALANCED_MAX_WIDTH = 1199;

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

export function getGalaxyStarLimit(tier: GalaxyMotionTier): number {
  if (tier === 'static') return 4;
  if (tier === 'balanced') return 7;
  return 10;
}

export function getShootingStarTiming(tier: Exclude<GalaxyMotionTier, 'static'>): ShootingStarTiming {
  if (tier === 'balanced') {
    return {
      firstDelayMin: 35_000,
      firstDelayVariation: 20_000,
      repeatDelayMin: 70_000,
      repeatDelayVariation: 30_000,
      duration: 8_000,
    };
  }

  return {
    firstDelayMin: 8_000,
    firstDelayVariation: 4_000,
    repeatDelayMin: 30_000,
    repeatDelayVariation: 3_000,
    duration: 7_200,
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
