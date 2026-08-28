/**
 * Compatibilidade: a inicialização canônica vive em `src/i18n/index.ts`.
 * Este módulo permanece para não quebrar imports existentes.
 */
export { default, changeAppLocale, getCurrentAppLocale, getCurrentIntlLocale } from './index';
