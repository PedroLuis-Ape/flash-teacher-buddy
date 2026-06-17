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

export function getGalaxyCometPlan(tier: GalaxyMotionTier): GalaxyCometPlan {
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
      firstDelayMin: 30_000,
      firstDelayVariation: 20_000,
      repeatDelayMin: 90_000,
      repeatDelayVariation: 50_000,
      duration: 6_000,
      staggerDelays: [0],
    };
  }

  return {
    count: 4,
    firstDelayMin: 7_000,
    firstDelayVariation: 5_000,
    repeatDelayMin: 28_000,
    repeatDelayVariation: 7_000,
    duration: 7_200,
    staggerDelays: [0, 1_250, 2_650, 4_200],
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
