/**
 * Inicialização única de i18next para o APE.
 *
 * Regras:
 * - um só namespace (`translation`) montado a partir de arquivos por área,
 *   preservando as chaves já usadas no app (`common.*`, `sidebar.*`, ...);
 * - locale resolvido pela precedência de `./detect`;
 * - troca de idioma nunca recarrega a página e nunca toca em dados de estudo.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  APP_LOCALE_CODES,
  DEFAULT_APP_LOCALE,
  getIntlLocale,
  resolveAppLocale,
  type AppLocale,
} from './languages';
import {
  applyDocumentLocale,
  detectInitialLocale,
  persistLocale,
} from './detect';

import ptCommon from './resources/pt-BR/common.json';
import ptNav from './resources/pt-BR/nav.json';
import ptSidebar from './resources/pt-BR/sidebar.json';
import ptHome from './resources/pt-BR/home.json';
import ptFlashcards from './resources/pt-BR/flashcards.json';
import ptClasses from './resources/pt-BR/classes.json';
import ptDates from './resources/pt-BR/dates.json';
import ptLanguage from './resources/pt-BR/language.json';
import ptErrors from './resources/pt-BR/errors.json';
import ptStudy from './resources/pt-BR/study.json';

import enCommon from './resources/en/common.json';
import enNav from './resources/en/nav.json';
import enSidebar from './resources/en/sidebar.json';
import enHome from './resources/en/home.json';
import enFlashcards from './resources/en/flashcards.json';
import enClasses from './resources/en/classes.json';
import enDates from './resources/en/dates.json';
import enLanguage from './resources/en/language.json';
import enErrors from './resources/en/errors.json';
import enStudy from './resources/en/study.json';

import esCommon from './resources/es/common.json';
import esNav from './resources/es/nav.json';
import esSidebar from './resources/es/sidebar.json';
import esHome from './resources/es/home.json';
import esFlashcards from './resources/es/flashcards.json';
import esClasses from './resources/es/classes.json';
import esDates from './resources/es/dates.json';
import esLanguage from './resources/es/language.json';
import esErrors from './resources/es/errors.json';
import esStudy from './resources/es/study.json';

import frCommon from './resources/fr/common.json';
import frNav from './resources/fr/nav.json';
import frSidebar from './resources/fr/sidebar.json';
import frHome from './resources/fr/home.json';
import frFlashcards from './resources/fr/flashcards.json';
import frClasses from './resources/fr/classes.json';
import frDates from './resources/fr/dates.json';
import frLanguage from './resources/fr/language.json';
import frErrors from './resources/fr/errors.json';
import frStudy from './resources/fr/study.json';

import itCommon from './resources/it/common.json';
import itNav from './resources/it/nav.json';
import itSidebar from './resources/it/sidebar.json';
import itHome from './resources/it/home.json';
import itFlashcards from './resources/it/flashcards.json';
import itClasses from './resources/it/classes.json';
import itDates from './resources/it/dates.json';
import itLanguage from './resources/it/language.json';
import itErrors from './resources/it/errors.json';
import itStudy from './resources/it/study.json';

type Catalog = Record<string, unknown>;

const merge = (...parts: Catalog[]): Catalog => Object.assign({}, ...parts);

const catalogs: Record<AppLocale, Catalog> = {
  'pt-BR': merge(ptCommon, ptNav, ptSidebar, ptHome, ptFlashcards, ptClasses, ptDates, ptLanguage, ptErrors, ptStudy),
  en: merge(enCommon, enNav, enSidebar, enHome, enFlashcards, enClasses, enDates, enLanguage, enErrors, enStudy),
  es: merge(esCommon, esNav, esSidebar, esHome, esFlashcards, esClasses, esDates, esLanguage, esErrors, esStudy),
  fr: merge(frCommon, frNav, frSidebar, frHome, frFlashcards, frClasses, frDates, frLanguage, frErrors, frStudy),
  it: merge(itCommon, itNav, itSidebar, itHome, itFlashcards, itClasses, itDates, itLanguage, itErrors, itStudy),
};

const resources = Object.fromEntries(
  (Object.keys(catalogs) as AppLocale[]).map((locale) => [locale, { translation: catalogs[locale] }])
) as Record<AppLocale, { translation: Catalog }>;

const initialLocale = detectInitialLocale();

const initPromise = i18n.isInitialized
  ? Promise.resolve()
  : i18n.use(initReactI18next).init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_APP_LOCALE,
    supportedLngs: [...APP_LOCALE_CODES],
    nonExplicitSupportedLngs: true,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

/** Resolve quando o catálogo está pronto (usado em testes e bootstraps). */
export const i18nReady = Promise.resolve(initPromise).then(() => undefined);

applyDocumentLocale(initialLocale);

i18n.on('languageChanged', (next) => {
  const locale = resolveAppLocale(next);
  applyDocumentLocale(locale);
  persistLocale(locale);
});

/** Locale de interface atual, sempre normalizado. */
export function getCurrentAppLocale(): AppLocale {
  return resolveAppLocale(i18n.resolvedLanguage || i18n.language);
}

/** Locale Intl derivado do idioma de interface atual. */
export function getCurrentIntlLocale(): string {
  return getIntlLocale(getCurrentAppLocale());
}

/** Troca de idioma: imediata, persistida, sem reload e sem tocar na sessão. */
export async function changeAppLocale(next: unknown): Promise<AppLocale> {
  const locale = resolveAppLocale(next);
  persistLocale(locale);
  await i18n.changeLanguage(locale);
  applyDocumentLocale(locale);
  return locale;
}

export { catalogs as APP_TRANSLATION_CATALOGS };
export default i18n;
