/**
 * Merges folder glossary entries with per-card manual hints.
 * Entries are additive: shorter words and longer expressions coexist.
 */

import type { WordHint } from "./wordHints";
import { findGlossaryOccurrences } from "./glossaryLayers";
import { findRelevantGlossaryMatches } from "./glossaryIndex";

export interface GlossaryItem {
  original_text: string;
  translated_text: string;
  note?: string | null;
  side: "A" | "B";
  is_active: boolean;
}

export interface MergedHint {
  text: string;
  translations: { text: string; note?: string; source: "global" | "manual" }[];
  startIndex?: number;
  endIndex?: number;
}

export interface ExtendedWordHint extends WordHint {
  suppressGlobal?: boolean;
}

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function mergeNotes(current?: string, next?: string | null) {
  const notes = [current, next]
    .filter((note): note is string => Boolean(note?.trim()))
    .map((note) => note.trim());
  return Array.from(new Map(
    notes.map((note) => [normalize(note), note]),
  ).values()).join(" · ") || undefined;
}

function addTranslation(
  translations: MergedHint["translations"],
  next: MergedHint["translations"][number],
) {
  const existing = translations.find(
    (item) => normalize(item.text) === normalize(next.text),
  );
  if (!existing) {
    translations.push({ ...next, note: next.note?.trim() || undefined });
    return;
  }

  existing.note = mergeNotes(existing.note, next.note);
  if (next.source === "manual") existing.source = "manual";
}

export function splitGlossaryAlternatives(value: string): string[] {
  const unique = new Map<string, string>();
  value.split(/\s*[,;]\s*/u).forEach((part) => {
    const clean = part.trim();
    const key = normalize(clean);
    if (clean && !unique.has(key)) unique.set(key, clean);
  });
  return Array.from(unique.values());
}

export function parseExtendedWordHints(raw: unknown): ExtendedWordHint[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ExtendedWordHint =>
      typeof item === "object" &&
      item !== null &&
      typeof item.text === "string" &&
      item.text.trim().length > 0 &&
      typeof item.translation === "string" &&
      item.translation.trim().length > 0,
  );
}

function manualHintBelongsToSide(hint: ExtendedWordHint, side: "A" | "B") {
  const hintSide = hint.side ?? "A";
  return hintSide === side;
}

function addFolderTranslation(
  hintMap: Map<string, MergedHint>,
  suppressedTexts: Set<string>,
  text: string,
  matchText: string,
  translationText: string,
  note?: string | null,
) {
  const cleanMatch = matchText.trim();
  const cleanTranslation = translationText.trim();
  if (!cleanMatch || !cleanTranslation) return;
  if (findGlossaryOccurrences(text, cleanMatch).length === 0) return;

  const key = normalize(cleanMatch);
  if (suppressedTexts.has(key)) return;

  const merged = hintMap.get(key) ?? { text: cleanMatch, translations: [] };
  addTranslation(merged.translations, {
    text: cleanTranslation,
    note: note || undefined,
    source: "global",
  });
  hintMap.set(key, merged);
}

export function mergeGlossaryAndManual(
  text: string,
  side: "A" | "B",
  glossary: GlossaryItem[],
  manualHints: ExtendedWordHint[],
  _langContext?: { langA?: string; langB?: string },
): MergedHint[] {
  if (!text) return [];

  const relevantManual = manualHints.filter((hint) => manualHintBelongsToSide(hint, side));
  const hintMap = new Map<string, MergedHint>();
  const suppressedTexts = new Set(
    relevantManual
      .filter((hint) => hint.suppressGlobal)
      .map((hint) => normalize(hint.text)),
  );

  for (const candidate of findRelevantGlossaryMatches(text, side, glossary)) {
    addFolderTranslation(
      hintMap,
      suppressedTexts,
      text,
      candidate.matchText,
      candidate.translationText,
      candidate.note,
    );
  }

  for (const hint of relevantManual) {
    if (
      findGlossaryOccurrences(text, hint.text).length === 0
      && hint.startIndex === undefined
    ) continue;

    const key = normalize(hint.text);
    const merged = hintMap.get(key) ?? {
      text: hint.text,
      translations: [],
      startIndex: hint.startIndex,
      endIndex: hint.endIndex,
    };

    if (hint.startIndex !== undefined) {
      merged.startIndex = hint.startIndex;
      merged.endIndex = hint.endIndex;
    }

    addTranslation(merged.translations, {
      text: hint.translation.trim(),
      note: hint.note || undefined,
      source: "manual",
    });
    hintMap.set(key, merged);
  }

  return Array.from(hintMap.values()).sort((a, b) =>
    b.text.length - a.text.length || a.text.localeCompare(b.text)
  );
}

export function mergedHintsToWordHints(
  merged: MergedHint[],
): (WordHint & { _mergedTranslations?: MergedHint["translations"] })[] {
  return merged.map((hint) => ({
    text: hint.text,
    translation: hint.translations.map((translation) => translation.text).join(" · "),
    note: hint.translations
      .filter((translation) => translation.note)
      .map((translation) => translation.note)
      .join("; ") || undefined,
    startIndex: hint.startIndex,
    endIndex: hint.endIndex,
    _mergedTranslations: hint.translations,
  }));
}
