import { describe, expect, it } from 'vitest';
import { buildPublicTurmaSearchParams, resolveTurmaViewMode } from './turmaAccess';

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

describe('buildPublicTurmaSearchParams', () => {
  it('preserves preview mode while opening an assignment', () => {
    expect(buildPublicTurmaSearchParams({
      publicPreview: true,
      assignmentId: 'assignment-123',
    }).toString()).toBe('publicPreview=true&atribuicao=assignment-123');
  });

  it('keeps preview mode when returning to the classroom root', () => {
    expect(buildPublicTurmaSearchParams({
      publicPreview: true,
    }).toString()).toBe('publicPreview=true');
  });

  it('supports normal public navigation without preview mode', () => {
    expect(buildPublicTurmaSearchParams({
      publicPreview: false,
      assignmentId: 'assignment-123',
    }).toString()).toBe('atribuicao=assignment-123');
  });

  it('returns empty parameters at the normal public classroom root', () => {
    expect(buildPublicTurmaSearchParams({
      publicPreview: false,
    }).toString()).toBe('');
  });
});
