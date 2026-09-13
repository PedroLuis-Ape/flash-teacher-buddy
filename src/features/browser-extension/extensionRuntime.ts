/**
 * Acesso defensivo às APIs do navegador usadas pela integração com a extensão.
 *
 * Nenhuma função aqui pode lançar: em ambiente sem window/chrome/storage
 * (SSR, Firefox, Safari, mobile) o app deve continuar funcionando normalmente.
 */

export interface ChromeRuntimeLike {
  id?: string;
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback?: (response?: unknown) => void,
  ) => void;
  lastError?: { message?: string };
}

export interface ChromeLike {
  runtime?: ChromeRuntimeLike;
}

export interface CompatibilityEnvironment {
  /** navigator.userAgentData?.mobile quando o navegador expõe Client Hints. */
  userAgentMobile?: boolean;
  /** navigator.userAgentData?.brands (ex.: "Chromium", "Google Chrome"). */
  brands?: readonly string[];
  userAgent?: string;
  /**
   * true quando existe chrome.runtime.sendMessage.
   *
   * ATENÇÃO: NÃO é sinal de compatibilidade. Em página comum o canal só existe
   * quando ALGUMA extensão instalada declara `externally_connectable` para o
   * domínio — ou seja, ele falta justamente para a persona-alvo do convite
   * (Chromium desktop SEM a extensão). Serve apenas para decidir se vale pingar.
   */
  extensionMessaging: boolean;
}

type NavigatorWithHints = Navigator & {
  userAgentData?: { mobile?: boolean; brands?: readonly { brand?: string }[] };
};

/** Leitura defensiva: nenhum getter do navegador pode quebrar o app. */
function readMobileHint(nav: NavigatorWithHints | undefined): boolean | undefined {
  try {
    return nav?.userAgentData?.mobile;
  } catch {
    return undefined;
  }
}

function readBrandHints(nav: NavigatorWithHints | undefined): string[] | undefined {
  try {
    const brands = nav?.userAgentData?.brands;
    if (!Array.isArray(brands)) return undefined;
    const names = brands
      .map((entry) => (typeof entry?.brand === "string" ? entry.brand.trim() : ""))
      .filter((brand) => brand.length > 0);
    return names.length > 0 ? names : undefined;
  } catch {
    return undefined;
  }
}

function readUserAgent(nav: NavigatorWithHints | undefined): string {
  try {
    return nav?.userAgent ?? "";
  } catch {
    return "";
  }
}

export function getWindowObject(): (Window & typeof globalThis) | undefined {
  if (typeof window === "undefined") return undefined;
  return window as Window & typeof globalThis;
}

export function getChromeLike(): ChromeLike | undefined {
  const win = getWindowObject() as unknown as { chrome?: ChromeLike } | undefined;
  return win?.chrome;
}

export function getExtensionMessaging(): ChromeRuntimeLike | undefined {
  const runtime = getChromeLike()?.runtime;
  if (!runtime || typeof runtime.sendMessage !== "function") return undefined;
  return runtime;
}

export function readCompatibilityEnvironment(): CompatibilityEnvironment {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as NavigatorWithHints);
  return {
    userAgentMobile: readMobileHint(nav),
    brands: readBrandHints(nav),
    userAgent: readUserAgent(nav),
    extensionMessaging: Boolean(getExtensionMessaging()),
  };
}

function safeStorage(reader: () => Storage | undefined): Storage | undefined {
  try {
    return reader();
  } catch {
    return undefined;
  }
}

export function getLocalStorage(): Storage | undefined {
  return safeStorage(() => getWindowObject()?.localStorage);
}

export function getSessionStorage(): Storage | undefined {
  return safeStorage(() => getWindowObject()?.sessionStorage);
}
