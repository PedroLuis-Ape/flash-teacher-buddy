import { describe, expect, it } from 'vitest';
import { isProtectedPath, isPublicClassSharePath } from './sessionRouteAccess';

describe('public classroom route access', () => {
  it('allows the exact public classroom share route', () => {
    expect(isPublicClassSharePath('/turmas/123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isProtectedPath('/turmas/123e4567-e89b-12d3-a456-426614174000')).toBe(false);
  });

  it('keeps classroom dashboards protected', () => {
    expect(isProtectedPath('/turmas')).toBe(true);
    expect(isProtectedPath('/turmas/professor')).toBe(true);
    expect(isProtectedPath('/turmas/aluno')).toBe(true);
  });

  it('does not expose nested classroom administration routes', () => {
    expect(isPublicClassSharePath('/turmas/123/membros')).toBe(false);
    expect(isProtectedPath('/turmas/123/membros')).toBe(true);
  });

  it('keeps portal study routes public', () => {
    expect(isProtectedPath('/portal/list/123/study')).toBe(false);
  });
});
