/**
 * Política única do convite da extensão "Salvar nas Notas": ONDE ele pode
 * existir e SE ele deve aparecer.
 *
 * Regra vigente — substitui a versão anterior, que exigia login em toda parte:
 *
 * - LANDING PÚBLICA: elegível SEM autenticação (página de aquisição).
 * - APP AUTENTICADO: continua elegível quando as demais condições passam.
 *
 * Em qualquer superfície, nunca mostrar quando: a extensão está instalada, o
 * dispositivo é mobile, o navegador é incompatível, o snooze está ativo ou o
 * convite já foi visto nesta sessão. Login NÃO é gate da landing.
 */

import { isActiveStudyPath } from "@/lib/isActiveStudyPath";
import { isProtectedPath, isPublicLandingPath } from "@/lib/sessionRouteAccess";
import type { ExtensionStatus } from "./extensionConfig";

/** Superfícies autorizadas a considerar o convite. */
export type ExtensionPromptSurface = "public-landing" | "authenticated-app";

export interface ExtensionPromptSurfaceInput {
  pathname: string;
  authenticatedSession: boolean;
  safeMode: boolean;
}

/**
 * Decide se o convite pode ser montado na rota atual.
 *
 * `null` = nenhuma superfície autorizada (outras páginas públicas, rotas de
 * estudo em tela cheia ou Safe Mode).
 */
export function resolveExtensionPromptSurface(
  input: ExtensionPromptSurfaceInput,
): ExtensionPromptSurface | null {
  if (input.safeMode) return null;
  if (isActiveStudyPath(input.pathname)) return null;
  if (isPublicLandingPath(input.pathname)) return "public-landing";
  if (input.authenticatedSession && isProtectedPath(input.pathname)) {
    return "authenticated-app";
  }
  return null;
}

/** Motivos possíveis de não exibição (o primeiro que falha é reportado). */
export type ExtensionPromptBlockReason =
  | "browser-incompatible"
  | "mobile"
  | "extension-status-unknown"
  | "extension-installed"
  | "snooze-active"
  | "seen-this-session"
  | "dismissed-this-mount";

export interface ExtensionPromptGateSnapshot {
  route: string;
  extensionDetected: boolean;
  browserCompatible: boolean;
  isDesktop: boolean;
  /** Auditado para diagnóstico. NÃO é gate desde a correção da landing. */
  authenticated: boolean;
  snoozeActive: boolean;
  seenThisSession: boolean;
  finalEligibility: boolean;
  reasonNotShown: ExtensionPromptBlockReason | null;
}

export interface ExtensionPromptGateInput {
  route: string;
  authenticatedSession: boolean;
  browserCompatible: boolean;
  isDesktop: boolean;
  extensionStatus: ExtensionStatus;
  snoozeActive: boolean;
  seenThisSession: boolean;
  dismissedThisMount: boolean;
}

/**
 * Avalia os 7 gates do convite e devolve o motivo exato quando ele não aparece.
 */
export function evaluateExtensionPromptGates(
  input: ExtensionPromptGateInput,
): ExtensionPromptGateSnapshot {
  const extensionDetected = input.extensionStatus === "installed";
  const extensionChecked = extensionDetected || input.extensionStatus === "missing";

  const reasonNotShown: ExtensionPromptBlockReason | null = !input.browserCompatible
    ? "browser-incompatible"
    : !input.isDesktop
      ? "mobile"
      : !extensionChecked
        ? "extension-status-unknown"
        : extensionDetected
          ? "extension-installed"
          : input.snoozeActive
            ? "snooze-active"
            : input.seenThisSession
              ? "seen-this-session"
              : input.dismissedThisMount
                ? "dismissed-this-mount"
                : null;

  return {
    route: input.route,
    extensionDetected,
    browserCompatible: input.browserCompatible,
    isDesktop: input.isDesktop,
    authenticated: input.authenticatedSession,
    snoozeActive: input.snoozeActive,
    seenThisSession: input.seenThisSession,
    finalEligibility: reasonNotShown === null,
    reasonNotShown,
  };
}

/**
 * Diagnóstico de desenvolvimento: `window.pitecoExtensionPromptDebug`.
 * Sem dados pessoais e inerte em produção (`import.meta.env.DEV`).
 */
export function publishExtensionPromptDebug(snapshot: ExtensionPromptGateSnapshot): void {
  try {
    if (typeof window === "undefined") return;
    (window as unknown as { pitecoExtensionPromptDebug?: ExtensionPromptGateSnapshot })
      .pitecoExtensionPromptDebug = snapshot;
  } catch {
    // Diagnóstico nunca pode quebrar a interface.
  }
}

export default evaluateExtensionPromptGates;

