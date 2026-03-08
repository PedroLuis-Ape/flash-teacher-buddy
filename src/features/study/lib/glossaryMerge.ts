/**
 * glossaryMerge — Merges global list glossary with per-card manual word hints.
 *
 * Rules:
 * 1. Global glossary entries and manual card hints are COMPLEMENTARY by default.
 * 2. If a manual hint has `suppressGlobal: true`, global hints for the same text are hidden.
 * 3. Duplicate identical translations are deduplicated.
 */

import type { WordHint } from "./wordHints";

export interface GlossaryItem {
  original_text: string;
  translated_text: string;
  note?: string | null;
  side: "A" | "B";
  is_active: boolean;
}

export interface MergedHint {
  /** The matched text in the source */
  text: string;
  /** All translations to display (deduplicated) */
  translations: { text: string; note?: string; source: "global" | "manual" }[];
  /** For segmentation: startIndex/endIndex from the manual hint if available */
  startIndex?: number;
  endIndex?: number;
}

/**
 * Extended WordHint with optional suppress flag for the UI.
 */
export interface ExtendedWordHint extends WordHint {
  suppressGlobal?: boolean;
}

/**
 * Parse extended word hints from raw DB JSON.
 */
export function parseExtendedWordHints(raw: unknown): ExtendedWordHint[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ExtendedWordHint =>
      typeof item === "object" &&
      item !== null &&
      typeof item.text === "string" &&
      item.text.trim().length > 0 &&
      typeof item.translation === "string" &&
      item.translation.trim().length > 0
  );
}

/**
 * Merge global glossary entries with per-card manual hints for a given text.
 *
 * @param text - The text being rendered (e.g., the term or translation)
 * @param side - Which side this text is ("A" or "B")
 * @param glossary - Active global glossary items for this list
 * @param manualHints - Per-card word hints
 * @returns Array of MergedHint for rendering
 */
export function mergeGlossaryAndManual(
  text: string,
  side: "A" | "B",
  glossary: GlossaryItem[],
  manualHints: ExtendedWordHint[]
): MergedHint[] {
  if (!text) return [];

  const textLower = text.toLowerCase();

  // Build a map: normalized original_text -> MergedHint
  const hintMap = new Map<string, MergedHint>();

  // Collect manual hints that suppress global
  const suppressedTexts = new Set<string>();
  for (const mh of manualHints) {
    if (mh.suppressGlobal) {
      suppressedTexts.add(mh.text.toLowerCase());
    }
  }

  // 1. Add global glossary entries matching this side
  for (const g of glossary) {
    if (!g.is_active) continue;
    if (g.side !== side) continue;

    const key = g.original_text.toLowerCase();
    // Check if text contains this glossary term
    if (!textLower.includes(key)) continue;
    // Check if suppressed by a manual hint
    if (suppressedTexts.has(key)) continue;

    if (!hintMap.has(key)) {
      hintMap.set(key, {
        text: g.original_text,
        translations: [],
      });
    }
    const merged = hintMap.get(key)!;
    const translation = g.translated_text.trim();
    if (!merged.translations.some((t) => t.text === translation && t.source === "global")) {
      merged.translations.push({ text: translation, note: g.note || undefined, source: "global" });
    }
  }

  // 2. Add manual hints
  for (const mh of manualHints) {
    const key = mh.text.toLowerCase();
    // Manual hints are always added (they are context-specific)
    if (!hintMap.has(key)) {
      hintMap.set(key, {
        text: mh.text,
        translations: [],
        startIndex: mh.startIndex,
        endIndex: mh.endIndex,
      });
    }
    const merged = hintMap.get(key)!;
    // Prefer manual indices
    if (mh.startIndex !== undefined) {
      merged.startIndex = mh.startIndex;
      merged.endIndex = mh.endIndex;
    }
    const translation = mh.translation.trim();
    if (!merged.translations.some((t) => t.text === translation)) {
      merged.translations.push({ text: translation, note: mh.note || undefined, source: "manual" });
    }
  }

  return Array.from(hintMap.values());
}

/**
 * Convert MergedHint[] back to WordHint[] for use with segmentText().
 * Each MergedHint produces one WordHint with combined translation text.
 */
export function mergedHintsToWordHints(merged: MergedHint[]): (WordHint & { _mergedTranslations?: MergedHint["translations"] })[] {
  return merged.map((m) => ({
    text: m.text,
    // Primary translation for backwards compat
    translation: m.translations.map((t) => t.text).join(" · "),
    note: m.translations
      .filter((t) => t.note)
      .map((t) => t.note)
      .join("; ") || undefined,
    startIndex: m.startIndex,
    endIndex: m.endIndex,
    _mergedTranslations: m.translations,
  }));
}
