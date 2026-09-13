/**
 * Compatibilidade e detecção da extensão "Salvar nas Notas".
 *
 * Duas perguntas separadas, com fontes diferentes:
 *
 * 1. COMPATIBILIDADE (o convite pode existir?) — sinais do navegador:
 *    Client Hints/user-agent provando Chromium desktop. NUNCA chrome.runtime.
 * 2. DETECÇÃO (a extensão já está instalada?) — o único uso de
 *    chrome.runtime.sendMessage: canal ausente, erro ou timeout = "missing".
 */

import {
  EXTENSION_ID,
  EXTENSION_PING_MESSAGE,
  PING_TIMEOUT_MS,
  type ExtensionStatus,
} from "./extensionConfig";
import {
  getExtensionMessaging,
  readCompatibilityEnvironment,
  type CompatibilityEnvironment,
} from "./extensionRuntime";

const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i;

/**
 * Marcas de User-Agent Client Hints que provam motor Chromium. Catálogo real:
 * Chrome = "Chromium" + "Google Chrome"; Edge = "Chromium" + "Microsoft Edge".
 * Marcas do tipo "Not_A Brand" (GREASE) não casam aqui.
 */
const CHROMIUM_HINT_BRAND =
  /^(chromium|google chrome|microsoft edge|opera|brave|vivaldi|samsung internet|oculus)/i;

/** Token de user-agent que prova Chromium (fallback sem Client Hints). */
const CHROMIUM_USER_AGENT = /(Chrome|Chromium|CriOS|EdgA?|EdgiOS|OPR|SamsungBrowser)\//;

/** Gecko (Firefox) não suporta extensões do Chrome. */
const GECKO_USER_AGENT = /Firefox\/|FxiOS\//;

/**
 * WebKit puro (Safari). O token "Safari/" TAMBÉM aparece no user-agent do
 * Chrome, por isso esta checagem só vale depois da checagem de Chromium.
 */
const WEBKIT_USER_AGENT = /Safari\//;

export function isMobileEnvironment(env: CompatibilityEnvironment): boolean {
  if (env.userAgentMobile === true) return true;
  if (env.userAgentMobile === false) return false;
  return MOBILE_USER_AGENT.test(env.userAgent ?? "");
}

export function isChromiumBrandList(brands: readonly string[] | undefined): boolean {
  if (!brands || brands.length === 0) return false;
  return brands.some((brand) => CHROMIUM_HINT_BRAND.test(brand.trim()));
}

/**
 * Desktop + navegador Chromium — a ÚNICA pergunta de compatibilidade.
 *
 * Deliberadamente NÃO usa `chrome.runtime`: em uma página comum o canal só
 * existe quando alguma extensão instalada declara `externally_connectable` para
 * aquele domínio. Exigir o canal escondia o convite exatamente da persona-alvo
 * (Chromium desktop sem a extensão). O canal é usado só para DETECTAR a
 * extensão (ping em `pingExtension`).
 *
 * Fail-closed: mobile, Firefox, Safari e navegador não reconhecido → false.
 */
export function detectExtensionCompatibility(env: CompatibilityEnvironment): boolean {
  if (isMobileEnvironment(env)) return false;
  if (isChromiumBrandList(env.brands)) return true;

  const userAgent = env.userAgent ?? "";
  if (GECKO_USER_AGENT.test(userAgent)) return false;
  if (CHROMIUM_USER_AGENT.test(userAgent)) return true;
  if (WEBKIT_USER_AGENT.test(userAgent)) return false;
  return false;
}

export type ExtensionPingResult = "installed" | "missing";

/** Timeout curto: ausência de resposta é tratada como "não instalada". */
export function pingExtension(timeoutMs: number = PING_TIMEOUT_MS): Promise<ExtensionPingResult> {
  const runtime = getExtensionMessaging();
  if (!runtime?.sendMessage) return Promise.resolve("missing");

  return new Promise<ExtensionPingResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (value: ExtensionPingResult) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(value);
    };

    timer = setTimeout(() => settle("missing"), timeoutMs);

    try {
      runtime.sendMessage(EXTENSION_ID, EXTENSION_PING_MESSAGE, (response) => {
        // Ler lastError dentro do callback evita "Unchecked runtime.lastError".
        if (runtime.lastError) {
          settle("missing");
          return;
        }
        const installed = Boolean(
          response && (response as { installed?: unknown }).installed === true,
        );
        settle(installed ? "installed" : "missing");
      });
    } catch {
      settle("missing");
    }
  });
}

export async function resolveExtensionStatus(
  env: CompatibilityEnvironment = readCompatibilityEnvironment(),
): Promise<ExtensionStatus> {
  if (!detectExtensionCompatibility(env)) return "unsupported";
  try {
    return await pingExtension();
  } catch {
    return "missing";
  }
}
