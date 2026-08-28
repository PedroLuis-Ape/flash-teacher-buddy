// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';


import i18n, { APP_TRANSLATION_CATALOGS, changeAppLocale, getCurrentIntlLocale } from '../index';
import { APP_LOCALE_CODES, type AppLocale } from '../languages';

function flatten(value: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      flatten(item as Record<string, unknown>, path, out);
    } else {
      out[path] = item;
    }
  }
  return out;
}

const flattened = Object.fromEntries(
  APP_LOCALE_CODES.map((locale) => [locale, flatten(APP_TRANSLATION_CATALOGS[locale] as Record<string, unknown>)])
) as Record<AppLocale, Record<string, unknown>>;

describe('paridade dos catálogos de interface', () => {
  const baseKeys = Object.keys(flattened['pt-BR']).sort();

  it.each(APP_LOCALE_CODES.filter((locale) => locale !== 'pt-BR'))(
    '%s possui exatamente as chaves de pt-BR',
    (locale) => {
      expect(Object.keys(flattened[locale]).sort()).toEqual(baseKeys);
    }
  );

  it.each([...APP_LOCALE_CODES])('%s não possui valores vazios', (locale) => {
    const empty = Object.entries(flattened[locale])
      .filter(([, value]) => typeof value === 'string' && value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});

describe('troca de idioma', () => {
  it.each([...APP_LOCALE_CODES])('resolve chaves reais em %s sem fallback', async (locale) => {
    await changeAppLocale(locale);
    expect(i18n.resolvedLanguage).toBe(locale);
    expect(i18n.getResource(locale, 'translation', 'nav.home')).toBeTruthy();
    expect(i18n.t('nav.home')).toBe(flattened[locale]['nav.home']);
    await changeAppLocale('pt-BR');
  });

  it('mantém pluralização por idioma', async () => {
    await changeAppLocale('fr');
    expect(i18n.t('common.cardCount', { count: 1 })).toBe('1 carte');
    expect(i18n.t('common.cardCount', { count: 3 })).toBe('3 cartes');
    await changeAppLocale('it');
    expect(i18n.t('common.cardCount', { count: 2 })).toBe('2 schede');
    await changeAppLocale('pt-BR');
    expect(i18n.t('common.cardCount', { count: 2 })).toBe('2 cards');
  });

  it('atualiza o locale Intl e o atributo lang do documento', async () => {
    await changeAppLocale('es');
    expect(getCurrentIntlLocale()).toBe('es-ES');
    expect(document.documentElement.lang).toBe('es');
    await changeAppLocale('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('persiste a escolha no armazenamento local', async () => {
    await changeAppLocale('it');
    expect(window.localStorage.getItem('ape.uiLocale')).toBe('it');
    await changeAppLocale('pt-BR');
  });
});
