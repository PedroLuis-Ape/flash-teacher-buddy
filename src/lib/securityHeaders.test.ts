import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');

describe('deployment permissions policy', () => {
  it('keeps microphone access available to the app pronunciation flows', () => {
    expect(headers).toContain('microphone=(self)');
    expect(headers).not.toContain('microphone=()');
  });

  it('keeps unused sensitive capabilities disabled', () => {
    expect(headers).toContain('camera=()');
    expect(headers).toContain('geolocation=()');
  });
});
