import { isTypingTarget } from "./keyboardShortcuts";

/**
 * Dono único do teclado da sessão de estudo.
 *
 * Antes cada componente decidia sozinho se podia tratar uma tecla; bastava um
 * handler esquecer a checagem (ou usar capture e passar na frente do campo) para
 * um `Q`/`A`/`W`/`D` virar comando enquanto o aluno escrevia. Aqui existe uma
 * escada explícita de contexto, e TODO handler de sessão pergunta para ela antes
 * de agir:
 *
 * ```text
 * modal        → só comandos do modal
 * text-entry   → só digitação (+ o que o campo permitir, como Enter)
 * feedback     → atalhos voltam a valer depois que a resposta foi enviada
 * activity     → atalhos do modo
 * session      → atalhos globais
 * ```
 */
export type ShortcutScope = "session" | "activity" | "feedback" | "text-entry" | "modal";

const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  session: 0,
  activity: 1,
  feedback: 2,
  "text-entry": 3,
  modal: 4,
};

const BLOCKING_SCOPES: ShortcutScope[] = ["text-entry", "modal"];

const scopes = new Map<string, ShortcutScope>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Registra o escopo de um dono (ex.: `write-textarea`, `game-settings-dialog`).
 * Vários donos convivem: vale sempre o mais restrito que estiver ativo.
 */
export function setShortcutScope(owner: string, scope: ShortcutScope | null): void {
  if (!owner) return;
  if (scope === null) {
    if (!scopes.has(owner)) return;
    scopes.delete(owner);
  } else {
    if (scopes.get(owner) === scope) return;
    scopes.set(owner, scope);
  }
  notify();
}

export function clearShortcutScope(owner: string): void {
  setShortcutScope(owner, null);
}

export function getActiveShortcutScope(): ShortcutScope {
  let active: ShortcutScope = "session";
  scopes.forEach((scope) => {
    if (SCOPE_PRIORITY[scope] > SCOPE_PRIORITY[active]) active = scope;
  });
  return active;
}

export function subscribeShortcutScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test/teardown helper: limpa todos os donos registrados. */
export function resetShortcutScopes(): void {
  if (scopes.size === 0) return;
  scopes.clear();
  notify();
}

/**
 * Modal aberto no documento. O Radix marca `role=dialog` com `data-state=open`,
 * então isso cobre qualquer diálogo sem precisar instrumentar cada um.
 */
export function hasOpenModal(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'),
  );
}

export function isShortcutScopeBlocking(scope: ShortcutScope = getActiveShortcutScope()): boolean {
  return BLOCKING_SCOPES.includes(scope);
}

export interface SessionShortcutGuardOptions {
  /**
   * Só o modo que confirma resposta com Enter pode pedir essa exceção — e mesmo
   * assim ela vale apenas dentro do próprio campo de texto.
   */
  allowEnter?: boolean;
  /** Ignora a checagem de modal (para handlers que pertencem ao próprio modal). */
  ignoreModal?: boolean;
}

/**
 * Regra única: um comando da sessão só roda quando nada mais restrito está ativo
 * e o evento não veio de um campo de texto.
 */
export function shouldBlockSessionShortcut(
  event: KeyboardEvent,
  options: SessionShortcutGuardOptions = {},
): boolean {
  if (!options.ignoreModal && hasOpenModal()) return true;
  if (isShortcutScopeBlocking()) return true;
  if (isTypingTarget(event.target)) return !(options.allowEnter && event.key === "Enter");
  return false;
}
