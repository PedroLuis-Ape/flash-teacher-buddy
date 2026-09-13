/**
 * Persistência local do convite da extensão. Sem Supabase.
 *
 * - snooze explícito (X): 7 dias, em localStorage
 * - marca de sessão (auto-dismiss ou X): sessionStorage
 *
 * Falha de storage nunca propaga erro para a interface.
 */

import { PROMPT_SESSION_KEY, PROMPT_SNOOZE_KEY, SNOOZE_DURATION_MS } from "./extensionConfig";
import { getLocalStorage, getSessionStorage } from "./extensionRuntime";

export function readSnoozeUntil(storage: Storage | undefined = getLocalStorage()): number {
  try {
    const raw = storage?.getItem(PROMPT_SNOOZE_KEY);
    if (raw === null || raw === undefined) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function isPromptSnoozed(
  storage: Storage | undefined = getLocalStorage(),
  now: number = Date.now(),
): boolean {
  return readSnoozeUntil(storage) > now;
}

export function snoozeExtensionPrompt(
  storage: Storage | undefined = getLocalStorage(),
  now: number = Date.now(),
): number {
  const until = now + SNOOZE_DURATION_MS;
  try {
    storage?.setItem(PROMPT_SNOOZE_KEY, String(until));
  } catch {
    // Sem storage o convite apenas reaparece no próximo carregamento.
  }
  return until;
}

export function wasPromptSeenThisSession(storage: Storage | undefined = getSessionStorage()): boolean {
  try {
    return storage?.getItem(PROMPT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberPromptSeenThisSession(
  storage: Storage | undefined = getSessionStorage(),
): void {
  try {
    storage?.setItem(PROMPT_SESSION_KEY, "1");
  } catch {
    // Sem sessionStorage o convite reaparece apenas até o auto-dismiss.
  }
}
