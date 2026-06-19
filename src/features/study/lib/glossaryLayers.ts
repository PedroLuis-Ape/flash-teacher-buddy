import type { MergedHint } from "./glossaryMerge";
import { parseWordHints, type WordHint } from "./wordHints";

export type GlossaryTranslationSource = "global" | "manual";

export interface LayeredHintDefinition {
  key: string;
  text: string;
  translations: Array<{
    text: string;
    note?: string;
    source: GlossaryTranslationSource;
  }>;
  startIndex?: number;
  endIndex?: number;
}

export interface LayeredHintMatch extends LayeredHintDefinition {
  startIndex: number;
  endIndex: number;
}

export interface LayeredTextSegment {
  value: string;
  startIndex: number;
  endIndex: number;
  matches: LayeredHintMatch[];
}

const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;
const TOKEN_REGEX = /\s+|[\p{L}\p{M}\p{N}_]+(?:['’\-][\p{L}\p{M}\p{N}_]+)*|[^\s]/gu;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function isWordChar(value: string | undefined): boolean {
  return !!value && WORD_CHAR.test(value);
}

/**
 * Finds every whole-word/whole-expression occurrence of a glossary term.
 * Whitespace inside multi-word expressions is flexible, so an entry such as
 * "because of" still matches text containing line breaks or repeated spaces.
 */
export function findGlossaryOccurrences(text: string, term: string): Array<{ startIndex: number; endIndex: number }> {
  const cleanTerm = term.trim();
  if (!text || !cleanTerm) return [];

  const parts = cleanTerm.split(/\s+/).map(escapeRegExp);
  const core = parts.join("\\s+");
  const prefix = isWordChar(cleanTerm[0]) ? "(?<![\\p{L}\\p{M}\\p{N}_])" : "";
  const suffix = isWordChar(cleanTerm[cleanTerm.length - 1]) ? "(?![\\p{L}\\p{M}\\p{N}_])" : "";
  const pattern = new RegExp(`${prefix}${core}${suffix}`, "giu");

  const matches: Array<{ startIndex: number; endIndex: number }> = [];
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    matches.push({ startIndex: match.index, endIndex: match.index + match[0].length });
  }
  return matches;
}

function validIndexedMatch(text: string, definition: LayeredHintDefinition) {
  const { startIndex, endIndex } = definition;
  if (typeof startIndex !== "number" || typeof endIndex !== "number") return null;
  if (startIndex < 0 || endIndex <= startIndex || endIndex > text.length) return null;
  const actual = text.slice(startIndex, endIndex);
  if (normalizeText(actual) !== normalizeText(definition.text)) return null;
  return { startIndex, endIndex };
}

function resolveMatches(text: string, definitions: LayeredHintDefinition[]): LayeredHintMatch[] {
  const resolved: LayeredHintMatch[] = [];
  const seen = new Set<string>();

  for (const definition of definitions) {
    const indexed = validIndexedMatch(text, definition);
    const occurrences = indexed ? [indexed] : findGlossaryOccurrences(text, definition.text);

    for (const occurrence of occurrences) {
      const occurrenceKey = `${definition.key}:${occurrence.startIndex}:${occurrence.endIndex}`;
      if (seen.has(occurrenceKey)) continue;
      seen.add(occurrenceKey);
      resolved.push({ ...definition, ...occurrence });
    }
  }

  return resolved.sort((a, b) => {
    const lengthDiff = (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
    if (lengthDiff !== 0) return lengthDiff;
    return a.startIndex - b.startIndex || a.text.localeCompare(b.text);
  });
}

function tokenize(text: string): Array<{ value: string; startIndex: number; endIndex: number }> {
  const tokens: Array<{ value: string; startIndex: number; endIndex: number }> = [];
  for (const match of text.matchAll(TOKEN_REGEX)) {
    if (match.index === undefined) continue;
    tokens.push({ value: match[0], startIndex: match.index, endIndex: match.index + match[0].length });
  }
  return tokens.length > 0 ? tokens : [{ value: text, startIndex: 0, endIndex: text.length }];
}

function sameMatchSet(a: LayeredHintMatch[], b: LayeredHintMatch[]) {
  if (a.length !== b.length) return false;
  return a.every((match, index) => match.key === b[index]?.key && match.startIndex === b[index]?.startIndex && match.endIndex === b[index]?.endIndex);
}

/**
 * Produces non-overlapping render segments while preserving every overlapping
 * glossary layer. A word can therefore belong to both its own entry and a
 * longer expression at the same time.
 */
export function buildLayeredTextSegments(text: string, definitions: LayeredHintDefinition[]): LayeredTextSegment[] {
  if (!text) return [{ value: "", startIndex: 0, endIndex: 0, matches: [] }];
  if (definitions.length === 0) return [{ value: text, startIndex: 0, endIndex: text.length, matches: [] }];

  const matches = resolveMatches(text, definitions);
  if (matches.length === 0) return [{ value: text, startIndex: 0, endIndex: text.length, matches: [] }];

  const segments: LayeredTextSegment[] = [];
  for (const token of tokenize(text)) {
    const tokenMatches = /^\s+$/u.test(token.value)
      ? []
      : matches.filter((match) => match.startIndex < token.endIndex && match.endIndex > token.startIndex);

    const previous = segments[segments.length - 1];
    if (previous && tokenMatches.length === 0 && previous.matches.length === 0) {
      previous.value += token.value;
      previous.endIndex = token.endIndex;
      continue;
    }
    if (previous && sameMatchSet(previous.matches, tokenMatches) && /^\s+$/u.test(token.value)) {
      previous.value += token.value;
      previous.endIndex = token.endIndex;
      continue;
    }

    segments.push({ ...token, matches: tokenMatches });
  }

  return segments;
}

export function definitionsFromMergedHints(hints: MergedHint[]): LayeredHintDefinition[] {
  return hints.map((hint, index) => ({
    key: `merged:${normalizeText(hint.text)}:${hint.startIndex ?? "all"}:${hint.endIndex ?? "all"}:${index}`,
    text: hint.text,
    translations: hint.translations.map((translation) => ({
      text: translation.text,
      note: translation.note,
      source: translation.source,
    })),
    startIndex: hint.startIndex,
    endIndex: hint.endIndex,
  }));
}

export function definitionsFromWordHints(raw: unknown): LayeredHintDefinition[] {
  return parseWordHints(raw).map((hint: WordHint, index) => ({
    key: `manual:${normalizeText(hint.text)}:${hint.startIndex ?? "all"}:${hint.endIndex ?? "all"}:${index}`,
    text: hint.text,
    translations: [{ text: hint.translation, note: hint.note, source: "manual" }],
    startIndex: hint.startIndex,
    endIndex: hint.endIndex,
  }));
}
