import { beforeEach, describe, expect, it } from 'vitest';

import {
  LEGACY_LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  applyDocumentLocale,
  persistLocale,
  readStoredLocale,
} from '../detect';

/** Ambiente mínimo: sem jsdom, apenas os contratos usados pelo módulo. */
function installBrowserGlobals() {
  const store = new Map<string, string>();
  const documentElement = { lang: '' };
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    },
    document: { documentElement },
  });
  return { store, documentElement };
}

describe('persistência do idioma de interface', () => {
  let env: ReturnType<typeof installBrowserGlobals>;

  beforeEach(() => {
    env = installBrowserGlobals();
  });

  it('grava a escolha nas chaves canônica e legada', () => {
    persistLocale('fr');
    expect(env.store.get(LOCALE_STORAGE_KEY)).toBe('fr');
    expect(env.store.get(LEGACY_LOCALE_STORAGE_KEY)).toBe('fr');
  });

  it('recupera a escolha após reload', () => {
    persistLocale('it');
    expect(readStoredLocale()).toBe('it');
  });

  it('normaliza a chave legada pt para pt-BR', () => {
    env.store.set(LEGACY_LOCALE_STORAGE_KEY, 'pt');
    expect(readStoredLocale()).toBe('pt-BR');
  });

  it('atualiza <html lang>', () => {
    applyDocumentLocale('es');
    expect(env.documentElement.lang).toBe('es');
  });
});
