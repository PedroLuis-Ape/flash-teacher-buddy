/**
 * Precedência única de idioma de interface:
 *   1. escolha explícita do usuário (persistida nesta chave)
 *   2. preferência persistida legada da aplicação
 *   3. idioma compatível do navegador
 *   4. pt-BR
 *
 * A persistência é local (localStorage). Sincronização cross-device por perfil
 * fica registrada como melhoria futura — nenhuma migration é criada aqui.
 */

import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from './languages';

export const LOCALE_STORAGE_KEY = 'ape.uiLocale';
/** Chave escrita pelo i18next-browser-languagedetector nas versões anteriores. */
export const LEGACY_LOCALE_STORAGE_KEY = 'i18nextLng';

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStoredLocale(): AppLocale | null {
  if (typeof window === 'undefined') return null;
  return (
    normalizeAppLocale(safeRead(LOCALE_STORAGE_KEY)) ??
    normalizeAppLocale(safeRead(LEGACY_LOCALE_STORAGE_KEY))
  );
}

export function persistLocale(locale: AppLocale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    // Mantém a chave legada em sincronia para não reverter em builds antigos em cache.
    window.localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* armazenamento indisponível: a sessão atual continua no idioma escolhido */
  }
}

export function detectBrowserLocale(languages?: readonly string[]): AppLocale | null {
  const candidates =
    languages ??
    (typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean));

  for (const candidate of candidates) {
    const normalized = normalizeAppLocale(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export interface LocaleResolutionInput {
  explicit?: unknown;
  stored?: AppLocale | null;
  browser?: AppLocale | null;
}

/** Regra pura de precedência — testável sem DOM. */
export function resolveLocalePrecedence(input: LocaleResolutionInput): AppLocale {
  return (
    normalizeAppLocale(input.explicit) ??
    input.stored ??
    input.browser ??
    DEFAULT_APP_LOCALE
  );
}

export function detectInitialLocale(): AppLocale {
  return resolveLocalePrecedence({
    stored: readStoredLocale(),
    browser: detectBrowserLocale(),
  });
}

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}
