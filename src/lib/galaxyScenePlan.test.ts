import { describe, expect, it } from 'vitest';
import { getGalaxyScenePlan } from './galaxyPerformance';

describe('getGalaxyScenePlan', () => {
  it('keeps static mode free of extra assets', () => {
    expect(getGalaxyScenePlan('static')).toEqual({ nebula: false, dust: false, spiralMain: false, spiralDistant: false, planet: false, moon: false, animated: false });
  });

  it('limits balanced mode to static essential layers', () => {
    expect(getGalaxyScenePlan('balanced')).toEqual({ nebula: true, dust: false, spiralMain: true, spiralDistant: false, planet: true, moon: false, animated: false });
  });

  it('enables the complete scene only in full mode', () => {
    expect(getGalaxyScenePlan('full')).toEqual({ nebula: true, dust: true, spiralMain: true, spiralDistant: true, planet: true, moon: true, animated: true });
  });
});
