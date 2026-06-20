import { describe, expect, it } from 'vitest';
import {
  chooseGalaxyMotionTier,
  getGalaxyCometPlan,
  getGalaxyStarLimit,
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
  it('limits decorative stars by tier in standard mode', () => {
    expect(getGalaxyStarLimit('static')).toBe(4);
    expect(getGalaxyStarLimit('balanced')).toBe(7);
    expect(getGalaxyStarLimit('full')).toBe(10);
  });

  it('adds visible stars in high mode without changing the static safety tier', () => {
    expect(getGalaxyStarLimit('static', 'high')).toBe(4);
    expect(getGalaxyStarLimit('balanced', 'high')).toBe(10);
    expect(getGalaxyStarLimit('full', 'high')).toBe(16);
  });

  it('disables comets in static mode even when high quality is selected', () => {
    expect(getGalaxyCometPlan('static', 'high').count).toBe(0);
  });

  it('uses one comet in balanced standard mode', () => {
    const balanced = getGalaxyCometPlan('balanced');
    expect(balanced.count).toBe(1);
    expect(balanced.staggerDelays).toEqual([0]);
  });

  it('uses an adaptive four-comet shower on notebooks in high mode', () => {
    const balancedHigh = getGalaxyCometPlan('balanced', 'high');
    expect(balancedHigh.count).toBe(4);
    expect(balancedHigh.staggerDelays).toHaveLength(4);
    expect(balancedHigh.repeatDelayMin).toBeLessThan(30_000);
  });

  it('uses a four-comet staggered group in full mode', () => {
    const full = getGalaxyCometPlan('full');
    expect(full.count).toBe(4);
    expect(full.staggerDelays).toHaveLength(4);
    expect(full.staggerDelays[0]).toBe(0);
    expect(full.staggerDelays[3]).toBeGreaterThanOrEqual(3_000);
    expect(full.staggerDelays[3]).toBeLessThanOrEqual(4_500);
  });

  it('keeps full comet traversal slow and observable', () => {
    const full = getGalaxyCometPlan('full');
    expect(full.duration).toBeGreaterThanOrEqual(6_000);
    expect(full.duration).toBeLessThanOrEqual(8_000);
  });

  it('keeps the standard animated tiers on a thirty-second repeat', () => {
    expect(getGalaxyCometPlan('balanced').repeatDelayMin).toBe(30_000);
    expect(getGalaxyCometPlan('full').repeatDelayMin).toBe(30_000);
  });
});
