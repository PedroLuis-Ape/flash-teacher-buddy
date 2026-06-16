import { describe, expect, it } from 'vitest';
import {
  chooseGalaxyMotionTier,
  getGalaxyStarLimit,
  getShootingStarTiming,
  type GalaxyCapabilitySnapshot,
} from './galaxyPerformance';

const capableDesktop: GalaxyCapabilitySnapshot = {
  viewportWidth: 1440,
  reducedMotion: false,
  slowUpdate: false,
  coarsePointer: false,
  saveData: false,
  deviceMemory: 16,
  hardwareConcurrency: 12,
};

describe('chooseGalaxyMotionTier', () => {
  it('uses the full tier on capable desktops', () => {
    expect(chooseGalaxyMotionTier(capableDesktop)).toBe('full');
  });

  it('uses the balanced tier on capable tablets and medium screens', () => {
    expect(chooseGalaxyMotionTier({ ...capableDesktop, viewportWidth: 1024, coarsePointer: true })).toBe('balanced');
  });

  it('forces a static background on mobile', () => {
    expect(chooseGalaxyMotionTier({ ...capableDesktop, viewportWidth: 430 })).toBe('static');
  });

  it('honors reduced motion and data saver', () => {
    expect(chooseGalaxyMotionTier({ ...capableDesktop, reducedMotion: true })).toBe('static');
    expect(chooseGalaxyMotionTier({ ...capableDesktop, saveData: true })).toBe('static');
  });

  it('protects low-memory and low-core devices regardless of viewport size', () => {
    expect(chooseGalaxyMotionTier({ ...capableDesktop, deviceMemory: 4 })).toBe('static');
    expect(chooseGalaxyMotionTier({ ...capableDesktop, hardwareConcurrency: 4 })).toBe('static');
  });
});

describe('galaxy animation budgets', () => {
  it('limits decorative stars by tier', () => {
    expect(getGalaxyStarLimit('static')).toBe(4);
    expect(getGalaxyStarLimit('balanced')).toBe(7);
    expect(getGalaxyStarLimit('full')).toBe(10);
  });

  it('keeps the desktop comet formation slow and close to a 30-second cycle', () => {
    const full = getShootingStarTiming('full');
    expect(full.duration).toBeGreaterThanOrEqual(7_000);
    expect(full.repeatDelayMin).toBe(30_000);
    expect(full.repeatDelayVariation).toBeLessThanOrEqual(5_000);
  });

  it('uses slower and less frequent shooting stars in balanced mode', () => {
    const full = getShootingStarTiming('full');
    const balanced = getShootingStarTiming('balanced');
    expect(balanced.duration).toBeGreaterThan(full.duration);
    expect(balanced.repeatDelayMin).toBeGreaterThan(full.repeatDelayMin);
  });
});
