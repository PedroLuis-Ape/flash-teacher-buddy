/**
 * Compatibilidade e detecção da extensão "Salvar nas Notas".
 *
 * Detecção por capacidade (chrome.runtime.sendMessage) + Client Hints de
 * mobile, com fallback de user-agent apenas quando userAgentData não existe.
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

export function isMobileEnvironment(env: CompatibilityEnvironment): boolean {
  if (env.userAgentMobile === true) return true;
  if (env.userAgentMobile === false) return false;
  return MOBILE_USER_AGENT.test(env.userAgent ?? "");
}

/**
 * Desktop + navegador Chromium. Sem chrome.runtime não existe canal externo
 * (Firefox, Safari, mobile) — nesse caso o convite nunca deve aparecer.
 */
export function detectExtensionCompatibility(env: CompatibilityEnvironment): boolean {
  if (!env.extensionMessaging) return false;
  return !isMobileEnvironment(env);
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
