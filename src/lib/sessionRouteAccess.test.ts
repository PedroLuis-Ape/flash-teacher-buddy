import { describe, expect, it } from 'vitest';
import {
  isProtectedPath,
  isPublicClassSharePath,
  isPublicPath,
  shouldUsePublicShell,
} from './sessionRouteAccess';

describe('public route access contract', () => {
  it.each([
    '/',
    '/landing',
    '/about',
    '/ingles-para-iniciantes',
    '/atividades-de-ingles',
    '/flashcards-de-ingles',
    '/para-professores',
    '/auth',
    '/auth/callback',
    '/portal',
    '/portal/list/123/study',
    '/pt-br',
    '/pt-br/recursos',
    '/pt-br/fonte-oficial',
    '/en',
    '/en/features',
    '/en/official-source',
  ])('keeps %s available without a private session', (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
    expect(isProtectedPath(pathname)).toBe(false);
  });

  it('normalizes trailing slashes and ignores search/hash fragments defensively', () => {
    expect(isPublicPath('/pt-br/')).toBe(true);
    expect(isPublicPath('/en/features/?source=test#overview')).toBe(true);
  });

  it.each([
    '/dashboard',
    '/folders',
    '/profile',
    '/pt-browser',
    '/english',
    '/portalized',
    '/authentication',
    '/about/team',
  ])('does not expose %s through a loose prefix match', (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
    expect(isProtectedPath(pathname)).toBe(true);
  });

  it('uses the public shell for locale routes regardless of authentication', () => {
    expect(shouldUsePublicShell('/pt-br/metodologia', true)).toBe(true);
    expect(shouldUsePublicShell('/pt-br/metodologia', false)).toBe(true);
  });
});

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

  it('preserves the existing guest-only public shell behavior for shared classrooms', () => {
    expect(shouldUsePublicShell('/turmas/123', true)).toBe(true);
    expect(shouldUsePublicShell('/turmas/123', false)).toBe(false);
  });
});
