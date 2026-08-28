/**
 * Identidade canônica dos idiomas de interface.
 *
 * ATENÇÃO: este módulo descreve SOMENTE o idioma da interface.
 * Os idiomas de estudo (lang_a / lang_b das listas e cards) são um domínio
 * independente e nunca devem ser derivados destes valores.
 */

export type AppLocale = 'pt-BR' | 'en' | 'es' | 'fr' | 'it';

export interface AppLocaleDefinition {
  /** Código canônico usado em i18next, <html lang> e persistência. */
  code: AppLocale;
  /** Nome no próprio idioma, exibido no seletor. */
  nativeName: string;
  /** Locale usado nas APIs Intl (números, datas, tempo relativo). */
  intlLocale: string;
  /** Bandeira/ícone opcional usado pela UI existente. */
  flag: string;
}

export const DEFAULT_APP_LOCALE: AppLocale = 'pt-BR';

export const APP_LOCALES: readonly AppLocaleDefinition[] = [
  { code: 'pt-BR', nativeName: 'Português', intlLocale: 'pt-BR', flag: '🇧🇷' },
  { code: 'en', nativeName: 'English', intlLocale: 'en-US', flag: '🇺🇸' },
  { code: 'es', nativeName: 'Español', intlLocale: 'es-ES', flag: '🇪🇸' },
  { code: 'fr', nativeName: 'Français', intlLocale: 'fr-FR', flag: '🇫🇷' },
  { code: 'it', nativeName: 'Italiano', intlLocale: 'it-IT', flag: '🇮🇹' },
] as const;

export const APP_LOCALE_CODES: readonly AppLocale[] = APP_LOCALES.map((locale) => locale.code);

/** Códigos legados que devem continuar funcionando após a migração. */
const LEGACY_ALIASES: Record<string, AppLocale> = {
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  es: 'es',
  'es-es': 'es',
  'es-mx': 'es',
  'es-ar': 'es',
  'es-419': 'es',
  fr: 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  it: 'it',
  'it-it': 'it',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && APP_LOCALE_CODES.includes(value as AppLocale);
}

/**
 * Normaliza qualquer string de idioma para um AppLocale suportado.
 * Retorna null quando não há correspondência (o chamador decide o fallback).
 */
export function normalizeAppLocale(value: unknown): AppLocale | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (isAppLocale(raw)) return raw;

  const lower = raw.toLowerCase();
  if (LEGACY_ALIASES[lower]) return LEGACY_ALIASES[lower];

  const base = lower.split(/[-_]/)[0];
  return LEGACY_ALIASES[base] ?? null;
}

export function resolveAppLocale(value: unknown, fallback: AppLocale = DEFAULT_APP_LOCALE): AppLocale {
  return normalizeAppLocale(value) ?? fallback;
}

export function getLocaleDefinition(code: AppLocale): AppLocaleDefinition {
  return APP_LOCALES.find((locale) => locale.code === code) ?? APP_LOCALES[0];
}

/** Locale para APIs Intl a partir de um código de interface. */
export function getIntlLocale(code: unknown): string {
  return getLocaleDefinition(resolveAppLocale(code)).intlLocale;
}
