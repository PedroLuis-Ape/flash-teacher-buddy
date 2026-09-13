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
  userAgent?: string;
  /** true quando existe chrome.runtime.sendMessage (Chrome/Edge/Brave/Opera). */
  extensionMessaging: boolean;
}

type NavigatorWithHints = Navigator & { userAgentData?: { mobile?: boolean } };

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
    userAgentMobile: nav?.userAgentData?.mobile,
    userAgent: nav?.userAgent ?? "",
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
