import { describe, expect, it } from 'vitest';
import { resolveTurmaViewMode } from './turmaAccess';

describe('resolveTurmaViewMode', () => {
  it('keeps owners and enrolled members in the complete classroom', () => {
    expect(resolveTurmaViewMode({
      publicPreview: false,
      authenticated: true,
      hasPrivateAccess: true,
    })).toBe('private');
  });

  it('sends authenticated non-members to the public read-only classroom', () => {
    expect(resolveTurmaViewMode({
      publicPreview: false,
      authenticated: true,
      hasPrivateAccess: false,
    })).toBe('public');
  });

  it('sends anonymous visitors to the public read-only classroom', () => {
    expect(resolveTurmaViewMode({
      publicPreview: false,
      authenticated: false,
      hasPrivateAccess: false,
    })).toBe('public');
  });

  it('forces public preview even when the authenticated user has private access', () => {
    expect(resolveTurmaViewMode({
      publicPreview: true,
      authenticated: true,
      hasPrivateAccess: true,
    })).toBe('public');
  });
});
