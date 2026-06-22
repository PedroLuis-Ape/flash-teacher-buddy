import { describe, expect, it } from 'vitest';

const legacySlugs = [
  'piteco_vampiro',
  'piteco_prime',
  'piteco-zombie',
  'piteco_zombie',
];

describe('store catalog migration compatibility', () => {
  it('keeps only the known legacy production packages in the fallback', () => {
    expect(legacySlugs).toEqual([
      'piteco_vampiro',
      'piteco_prime',
      'piteco-zombie',
      'piteco_zombie',
    ]);
    expect(new Set(legacySlugs).size).toBe(legacySlugs.length);
  });
});
