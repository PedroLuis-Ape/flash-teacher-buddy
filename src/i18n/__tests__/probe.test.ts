import { expect, it } from 'vitest';
import i18n, { i18nReady } from '@/i18n';
it('probe', async () => {
  await i18nReady;
  console.log('init', i18n.isInitialized, i18n.language, i18n.resolvedLanguage);
  console.log('t', i18n.t('nav.home'), JSON.stringify(i18n.getResource('pt-BR','translation','nav')));
  expect(true).toBe(true);
});
