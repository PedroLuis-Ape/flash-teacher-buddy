import { isTypingTarget } from "./keyboardShortcuts";
import { getActiveShortcutScope, hasOpenModal } from "./keyboardCommandRouter";

/**
 * "Type to answer": com teclado físico, a primeira tecla imprimível deve focar
 * o campo de resposta e entrar nele EXATAMENTE UMA VEZ — sem exigir clique e
 * sem autofocus por card (autofocus abriria o teclado virtual sozinho no
 * celular).
 *
 * Esta é a regra pura, testável sem DOM real. O hook apenas aplica a decisão.
 */

export interface TypeToAnswerKeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  target?: EventTarget | null;
}

export type TypeToAnswerBlockReason =
  | "disabled"
  | "modifier"
  | "composing"
  | "not-printable"
  | "editable-focus"
  | "overlay-open"
  | "scope-blocked";

export interface TypeToAnswerDecision {
  capture: boolean;
  reason?: TypeToAnswerBlockReason;
}

export interface TypeToAnswerOptions {
  /** O modo ativo realmente espera resposta textual agora. */
  enabled: boolean;
  /** Elemento com foco no momento do evento. */
  activeElement?: Element | null;
  /** Overlay interativo aberto (dialog, menu, popover, combobox, command). */
  overlayOpen?: boolean;
  /** Escopo do roteador único de teclado. */
  scopeBlocking?: boolean;
}

/** Só entrada de texto imprimível de um caractere conta como digitação. */
export function isPrintableTextKey(event: TypeToAnswerKeyLike): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (typeof event.key !== "string") return false;
  // Teclas nomeadas (Enter, Tab, Escape, Arrow*, F1..., Backspace) têm length > 1.
  if (event.key.length !== 1) return false;
  // Espaço isolado é atalho semântico em vários modos; não inicia digitação.
  if (event.key === " ") return false;
  return true;
}

/**
 * Overlays interativos abertos. O Radix marca `data-state="open"` e monta o
 * conteúdo em um popper wrapper, então isso cobre dialog, menu, popover,
 * select/combobox e command palette sem instrumentar cada componente.
 */
export function hasInteractiveOverlay(doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  if (!doc) return false;
  if (hasOpenModal()) return true;
  return Boolean(
    doc.querySelector(
      [
        '[role="menu"][data-state="open"]',
        '[role="listbox"]',
        '[role="combobox"][aria-expanded="true"]',
        '[data-radix-popper-content-wrapper]',
        '[cmdk-root]',
        '[data-state="open"][role="tooltip"]',
      ].join(", "),
    ),
  );
}

export function evaluateTypeToAnswerKey(
  event: TypeToAnswerKeyLike,
  options: TypeToAnswerOptions,
): TypeToAnswerDecision {
  if (!options.enabled) return { capture: false, reason: "disabled" };
  if (event.isComposing) return { capture: false, reason: "composing" };
  if (event.ctrlKey || event.metaKey || event.altKey) return { capture: false, reason: "modifier" };
  if (!isPrintableTextKey(event)) return { capture: false, reason: "not-printable" };
  if (options.overlayOpen) return { capture: false, reason: "overlay-open" };
  if (options.scopeBlocking) return { capture: false, reason: "scope-blocked" };
  if (isTypingTarget(event.target ?? null)) return { capture: false, reason: "editable-focus" };
  if (isTypingTarget(options.activeElement ?? null)) return { capture: false, reason: "editable-focus" };
  return { capture: true };
}

/** Lê o estado real do ambiente para os campos que dependem de DOM/roteador. */
export function readTypeToAnswerEnvironment(): Pick<TypeToAnswerOptions, "activeElement" | "overlayOpen" | "scopeBlocking"> {
  const doc = typeof document === "undefined" ? undefined : document;
  return {
    activeElement: doc?.activeElement ?? null,
    overlayOpen: hasInteractiveOverlay(doc),
    // `text-entry` do próprio campo não bloqueia: o campo é o destino. Só um
    // modal por cima impede a captura.
    scopeBlocking: getActiveShortcutScope() === "modal",
  };
}
