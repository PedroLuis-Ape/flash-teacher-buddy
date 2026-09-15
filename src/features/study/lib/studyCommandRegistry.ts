import type { ShortcutActionId } from "./keyboardShortcuts";
import { KEYBOARD_ACTIONS } from "./keyboardShortcuts";

/**
 * FONTE ÚNICA DE VERDADE dos comandos contextuais da sessão de estudo.
 *
 * Antes a lista de comandos exibida na UI e aquilo que o teclado realmente
 * executava eram decididos em lugares diferentes (string fixa em cada view +
 * `if` espalhado nos handlers). Resultado: comando visível que não funcionava e,
 * pior, comando invisível que ainda executava escondido — por exemplo
 * "Sabia / Não sabia" no Flip extenso e no Escrever.
 *
 * Regra: UI e execução consultam SEMPRE `resolveStudyCommands` /
 * `isStudyCommandAvailable`. Se um comando não está na lista resolvida, ele não
 * aparece e também não roda.
 */

export type StudyCommandMode =
  | "flip"
  | "write"
  | "multiple-choice"
  | "unscramble"
  | "pronunciation";

export type StudyCommandFlowMode = "continuous" | "mastery_rounds";

export interface StudyCommandContext {
  /** Modo efetivo em jogo (em sessão mista, o modo do slot atual). */
  mode: StudyCommandMode;
  /** Fluxo da sessão: Extenso (`continuous`) ou Gamificado (`mastery_rounds`). */
  flowMode: StudyCommandFlowMode;
  /** Há card seguinte navegável. */
  canGoNext?: boolean;
  /** Há card anterior navegável. */
  canGoPrevious?: boolean;
  /** O card atual tem mais de uma camada. */
  hasLayers?: boolean;
  /** A lista/sessão permite áudio. */
  ttsEnabled?: boolean;
  /** O modo está aguardando resposta textual (Escrever/Reescrever). */
  awaitingTextAnswer?: boolean;
  /** A resposta já foi enviada e o feedback está visível. */
  hasFeedback?: boolean;
}

export interface StudyCommandDescriptor {
  id: ShortcutActionId;
  label: string;
  description: string;
}

const META = new Map(KEYBOARD_ACTIONS.map((action) => [action.id, action]));

function describe(id: ShortcutActionId, overrides?: Partial<StudyCommandDescriptor>): StudyCommandDescriptor {
  const meta = META.get(id);
  return {
    id,
    label: overrides?.label ?? meta?.label ?? id,
    description: overrides?.description ?? meta?.description ?? "",
  };
}

/**
 * "Sabia / Não sabia" é avaliação de maestria. Só existe no Flip gamificado.
 * Nenhum outro modo (Escrever, Reescrever, Múltipla escolha, Desembaralhar,
 * Pronúncia) pode exibir ou executar avaliação in-game.
 */
export function isAssessmentAvailable(context: StudyCommandContext): boolean {
  return context.mode === "flip" && context.flowMode === "mastery_rounds";
}

/**
 * Navegação livre anterior/próximo: contrato do Flip extenso. No gamificado o
 * avanço é governado pela avaliação, então "próximo" não navega livremente.
 */
export function isFreeNavigationAvailable(context: StudyCommandContext): boolean {
  return context.mode === "flip" && context.flowMode === "continuous";
}

export function resolveStudyCommands(context: StudyCommandContext): StudyCommandDescriptor[] {
  const commands: StudyCommandDescriptor[] = [];
  const assessment = isAssessmentAvailable(context);
  const freeNavigation = isFreeNavigationAvailable(context);

  if (context.canGoPrevious !== false) commands.push(describe("prevCard"));

  if (freeNavigation) {
    if (context.canGoNext !== false) commands.push(describe("nextCard"));
  } else if (!assessment && context.mode !== "flip") {
    // Modos com resposta: "próximo" existe como avanço/pular do próprio modo.
    if (context.canGoNext !== false) commands.push(describe("nextCard"));
  }

  if (context.mode === "flip") commands.push(describe("flip"));

  if (context.mode === "write" || context.mode === "multiple-choice" || context.mode === "unscramble") {
    commands.push(
      describe("confirm", {
        label: context.hasFeedback ? "Continuar" : "Confirmar resposta",
      }),
    );
  }

  if (assessment) {
    commands.push(describe("knew"));
    commands.push(describe("didntKnow"));
  }

  if (context.mode === "write" && !context.hasFeedback) commands.push(describe("skip"));

  if (context.ttsEnabled !== false) {
    commands.push(
      describe("playAudio", {
        label: "Ouvir áudio",
        description: "Reproduz o conteúdo visível. Funciona mesmo com a reprodução automática desligada.",
      }),
    );
  }

  if (context.hasLayers) commands.push(describe("nextLayer"));

  commands.push(describe("restart"));

  return commands;
}

export function isStudyCommandAvailable(id: ShortcutActionId, context: StudyCommandContext): boolean {
  return resolveStudyCommands(context).some((command) => command.id === id);
}
