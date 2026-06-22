import { describe, expect, it } from 'vitest';
import { LEGACY_PRODUCTION_SLUGS } from './storeCatalogCompat';

describe('store catalog migration compatibility', () => {
  it('keeps only the known legacy production packages in the fallback', () => {
    expect(LEGACY_PRODUCTION_SLUGS).toEqual([
      'piteco_vampiro',
      'piteco_prime',
      'piteco-zombie',
      'piteco_zombie',
    ]);
    expect(new Set(LEGACY_PRODUCTION_SLUGS).size).toBe(LEGACY_PRODUCTION_SLUGS.length);
  });
});
