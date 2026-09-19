/**
 * Anotação pessoal de uso dentro do glossário in-game.
 *
 * Não existe tabela nova: a anotação é o campo `note` do WordHint contextual
 * do card. Estas funções são puras para poderem ser testadas sem banco e para
 * garantir que apenas a entrada alvo muda — outras palavras, ocorrências,
 * lados e traduções continuam exatamente como estavam.
 */
import { folderGlossaryIdentity } from "./folderGlossaryCompact";
import type { LayeredHintMatch } from "./glossaryLayers";
import type { WordHint } from "./wordHints";

export const GLOSSARY_NOTE_MAX_LENGTH = 500;

export interface GlossaryNoteTarget {
  text: string;
  /** Tradução exibida na entrada; nunca substituída pela anotação. */
  translation: string;
  side: "A" | "B";
  startIndex?: number;
  endIndex?: number;
  scope?: WordHint["scope"];
  kind?: WordHint["kind"];
  expression?: string;
  occurrence?: WordHint["occurrence"];
  segments?: WordHint["segments"];
}

const normalize = (value: string) => folderGlossaryIdentity(value);

export function sanitizeGlossaryNote(value: string): string {
  return value.replace(/\r\n?/gu, "\n").trim().slice(0, GLOSSARY_NOTE_MAX_LENGTH);
}

/**
 * Constrói a identidade da ocorrência a partir da entrada do glossário que o
 * aluno tocou. Duas ocorrências da mesma palavra na mesma frase continuam
 * sendo alvos diferentes. O caso clássico é "bank ... bank".
 */
export function buildGlossaryNoteTarget(
  match: Pick<LayeredHintMatch, "text" | "startIndex" | "endIndex" | "scope" | "kind" | "expression" | "occurrence" | "segments">,
  side: "A" | "B",
  translation: string,
): GlossaryNoteTarget {
  return {
    text: match.text,
    translation: translation.trim(),
    side,
    startIndex: match.startIndex,
    endIndex: match.endIndex,
    scope: match.scope,
    kind: match.kind,
    expression: match.expression,
    occurrence: match.occurrence,
    segments: match.segments,
  };
}

function spanKey(span: { text: string; startIndex: number; endIndex: number }) {
  return `${span.startIndex}:${span.endIndex}:${normalize(span.text)}`;
}

function sameSegments(a?: WordHint["segments"], b?: WordHint["segments"]) {
  if (!a?.length || !b?.length) return false;
  if (a.length !== b.length) return false;
  return a.every((span, index) => spanKey(span) === spanKey(b[index]));
}

export function hintMatchesNoteTarget(hint: WordHint, target: GlossaryNoteTarget): boolean {
  if (normalize(hint.text) !== normalize(target.text)) return false;
  if ((hint.side ?? "A") !== target.side) return false;

  if (target.segments?.length) return sameSegments(hint.segments, target.segments);

  const targetHasIndex = typeof target.startIndex === "number" && typeof target.endIndex === "number";
  const hintHasIndex = typeof hint.startIndex === "number" && typeof hint.endIndex === "number";
  if (targetHasIndex || hintHasIndex) {
    return hint.startIndex === target.startIndex && hint.endIndex === target.endIndex;
  }

  if (target.occurrence !== undefined) return hint.occurrence === target.occurrence;
  return true;
}

export function findNoteHint(hints: WordHint[], target: GlossaryNoteTarget): WordHint | undefined {
  return hints.find((hint) => hintMatchesNoteTarget(hint, target));
}

export function readGlossaryNote(hints: WordHint[], target: GlossaryNoteTarget): string {
  return findNoteHint(hints, target)?.note?.trim() ?? "";
}

/**
 * MARCAR/ATUALIZAR: cria ou atualiza apenas a entrada daquela ocorrência.
 * REMOVER: esvazia a anotação. Se a entrada existe só para hospedar a
 * anotação (noteOnly), ela deixa de existir junto com a nota.
 * Idempotente: aplicar duas vezes o mesmo resultado não duplica nada.
 */
export function applyGlossaryNote(
  hints: WordHint[],
  target: GlossaryNoteTarget,
  note: string,
): WordHint[] {
  const clean = sanitizeGlossaryNote(note);
  const index = hints.findIndex((hint) => hintMatchesNoteTarget(hint, target));

  if (index === -1) {
    const translation = target.translation.trim();
    if (!clean || !translation) return hints;
    return [
      ...hints,
      {
        text: target.text,
        translation,
        note: clean,
        side: target.side,
        scope: "contextual",
        kind: target.kind,
        expression: target.expression,
        occurrence: target.occurrence,
        startIndex: target.startIndex,
        endIndex: target.endIndex,
        segments: target.segments,
        noteOnly: true,
      },
    ];
  }

  const current = hints[index];
  if (!clean) {
    if (!current.note) return hints;
    if (current.noteOnly) {
      const next = [...hints];
      next.splice(index, 1);
      return next;
    }
    return hints.map((hint, position) => (position === index ? { ...hint, note: undefined } : hint));
  }

  // Repetir exatamente a mesma anotação é no-op, inclusive para a camada que
  // foi criada apenas para hospedar a nota.
  if (current.note?.trim() === clean) return hints;
  return hints.map((hint, position) => (
    position === index ? { ...hint, note: clean } : hint
  ));
}
