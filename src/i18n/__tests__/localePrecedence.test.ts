import { describe, expect, it } from 'vitest';

import {
  detectBrowserLocale,
  resolveLocalePrecedence,
} from '../detect';
import {
  APP_LOCALE_CODES,
  getIntlLocale,
  normalizeAppLocale,
  resolveAppLocale,
} from '../languages';

describe('identidade canônica dos idiomas', () => {
  it('expõe exatamente os idiomas suportados', () => {
    expect([...APP_LOCALE_CODES]).toEqual(['pt-BR', 'en', 'es', 'fr', 'it']);
  });

  it('normaliza códigos legados e variantes regionais', () => {
    expect(normalizeAppLocale('pt')).toBe('pt-BR');
    expect(normalizeAppLocale('pt-PT')).toBe('pt-BR');
    expect(normalizeAppLocale('en-GB')).toBe('en');
    expect(normalizeAppLocale('es-MX')).toBe('es');
    expect(normalizeAppLocale('fr-CA')).toBe('fr');
    expect(normalizeAppLocale('it-IT')).toBe('it');
    expect(normalizeAppLocale('de')).toBeNull();
  });

  it('cai para pt-BR quando o idioma não é suportado', () => {
    expect(resolveAppLocale('de')).toBe('pt-BR');
    expect(resolveAppLocale(undefined)).toBe('pt-BR');
  });

  it('mapeia locale Intl por idioma', () => {
    expect(getIntlLocale('pt-BR')).toBe('pt-BR');
    expect(getIntlLocale('en')).toBe('en-US');
    expect(getIntlLocale('es')).toBe('es-ES');
    expect(getIntlLocale('fr')).toBe('fr-FR');
    expect(getIntlLocale('it')).toBe('it-IT');
  });
});

describe('precedência de locale', () => {
  it('escolha explícita vence tudo', () => {
    expect(
      resolveLocalePrecedence({ explicit: 'fr', stored: 'es', browser: 'it' })
    ).toBe('fr');
  });

  it('preferência persistida vence o navegador', () => {
    expect(resolveLocalePrecedence({ stored: 'it', browser: 'es' })).toBe('it');
  });

  it('usa o navegador quando não há preferência salva', () => {
    expect(resolveLocalePrecedence({ browser: 'es' })).toBe('es');
  });

  it('cai para pt-BR sem nenhuma pista', () => {
    expect(resolveLocalePrecedence({})).toBe('pt-BR');
  });

  it('detecta o primeiro idioma compatível do navegador', () => {
    expect(detectBrowserLocale(['de-DE', 'nl', 'fr-FR'])).toBe('fr');
    expect(detectBrowserLocale(['ja'])).toBeNull();
  });
});
