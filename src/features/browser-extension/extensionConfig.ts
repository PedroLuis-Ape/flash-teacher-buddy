/**
 * Configuração central da extensão "Salvar nas Notas" no App Piteco.
 *
 * Fonte única de verdade do ID publicado, da URL da Chrome Web Store, dos
 * tempos do convite e das chaves de persistência local. Nenhum outro arquivo
 * deve redeclarar estes valores.
 *
 * O app NUNCA instala a extensão: o CTA apenas abre a Chrome Web Store em nova
 * aba e o usuário confirma a instalação.
 */

/** ID publicado da extensão "Salvar nas Notas". */
export const EXTENSION_ID = "gomkkomamhecmmomcpjmioikjadpddnh";

/** URL pública da Chrome Web Store (sem parâmetros de rastreio). */
export const WEB_STORE_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`;

/** Guia interna com instruções passo a passo (fallback informativo). */
export const INSTALL_GUIDE_URL = "/extensao/index.html";

/** Espera antes de mostrar o convite, para não competir com o boot do app. */
export const SHOW_DELAY_MS = 5_000;

/** Auto-dispensa do convite (só na sessão, não gera snooze). */
export const AUTO_DISMISS_MS = 15_000;

/** Duração do snooze após fechamento explícito pelo usuário. */
export const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1_000;

/** Timeout curto do ping para a extensão (ausência de resposta = não instalada). */
export const PING_TIMEOUT_MS = 1_200;

/** Duração da transição de saída antes de desmontar o convite. */
export const EXIT_ANIMATION_MS = 300;

/** localStorage: timestamp (ms) até quando o convite deve ficar silenciado. */
export const PROMPT_SNOOZE_KEY = "piteco_extension_prompt_dismissed_until";

/** sessionStorage: convite já visto/dispensado nesta sessão do navegador. */
export const PROMPT_SESSION_KEY = "piteco_extension_prompt_seen_session";

/** Payload único aceito pela extensão via chrome.runtime.sendMessage. */
export const EXTENSION_PING_MESSAGE = Object.freeze({ type: "PITECO_EXTENSION_PING" });

export type ExtensionStatus = "unknown" | "installed" | "missing" | "unsupported";
