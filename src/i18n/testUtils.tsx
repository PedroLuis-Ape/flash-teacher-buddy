/**
 * Utilitário de testes: renderizar/instanciar em um locale específico e
 * detectar fallback ou chave ausente.
 *
 * Uso:
 *   const { missingKeys } = await withLocale('fr', () => render(<Component />));
 */
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n, { changeAppLocale } from './index';
import { resolveAppLocale, type AppLocale } from './languages';

export interface LocaleStrictResult<T> {
  result: T;
  locale: AppLocale;
  missingKeys: string[];
  fallbackHits: string[];
}

/**
 * Executa `run` com o idioma solicitado ativo, registrando qualquer
 * missingKey ou uso de fallback ocorrido durante a execução.
 */
export async function withLocale<T>(
  locale: AppLocale,
  run: () => T | Promise<T>
): Promise<LocaleStrictResult<T>> {
  const previous = resolveAppLocale(i18n.resolvedLanguage || i18n.language);
  const missingKeys: string[] = [];
  const fallbackHits: string[] = [];

  const onMissingKey = (lngs: readonly string[], _ns: string, key: string) => {
    missingKeys.push(`${lngs.join('|')}:${key}`);
  };
  const onFallback = (lng: string, _ns: string, key: string) => {
    fallbackHits.push(`${lng}:${key}`);
  };

  i18n.on('missingKey', onMissingKey);
  // i18next emite este evento quando resolve por fallbackLng.
  i18n.store?.on?.('added', () => {});
  (i18n as unknown as { on: (event: string, cb: unknown) => void }).on('fallback', onFallback);

  await changeAppLocale(locale);
  try {
    const result = await run();
    return { result, locale, missingKeys, fallbackHits };
  } finally {
    i18n.off('missingKey', onMissingKey);
    (i18n as unknown as { off: (event: string, cb: unknown) => void }).off('fallback', onFallback);
    await changeAppLocale(previous);
  }
}

/** Envolve um elemento no provider de i18n já inicializado. */
export function wrapWithI18n(element: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{element}</I18nextProvider>;
}

export const TESTED_LOCALES: readonly AppLocale[] = ['pt-BR', 'en', 'es', 'fr', 'it'];
