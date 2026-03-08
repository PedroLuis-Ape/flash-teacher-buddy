/**
 * Word Hints — utility for matching and highlighting word/expression hints in text.
 *
 * A WordHint is a user-authored annotation linking a word or expression
 * in the original text to its translation + optional note.
 *
 * BACKWARD COMPATIBLE: If word_hints is null/undefined/empty, all helpers
 * return safe defaults (empty arrays, plain text).
 */

export interface WordHint {
  /** Original text segment to match (e.g. "am going") */
  text: string;
  /** Translation of the segment (e.g. "estou indo") */
  translation: string;
  /** Optional note/explanation */
  note?: string;
}

/** A segment of text that may or may not have a hint attached */
export interface TextSegment {
  /** The text content of this segment */
  value: string;
  /** If this segment matches a hint, the hint object */
  hint?: WordHint;
}

/**
 * Validate and normalize raw JSON from DB into WordHint[].
 * Returns empty array for any invalid/missing input.
 */
export function parseWordHints(raw: unknown): WordHint[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is WordHint =>
      typeof item === "object" &&
      item !== null &&
      typeof item.text === "string" &&
      item.text.trim().length > 0 &&
      typeof item.translation === "string" &&
      item.translation.trim().length > 0
  );
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split text into segments, matching hints longest-first.
 * Punctuation-tolerant: "market," will match hint "market".
 *
 * @param text - The full text to segment
 * @param hints - Array of WordHint objects
 * @returns Array of TextSegment objects in order
 */
export function segmentText(text: string, hints: WordHint[]): TextSegment[] {
  if (!text || !hints || hints.length === 0) {
    return [{ value: text || "" }];
  }

  // Sort by length descending so longer expressions match first
  const sorted = [...hints].sort((a, b) => b.text.length - a.text.length);

  // Build a combined regex with word boundaries (tolerant of trailing punctuation)
  // Each hint gets a capture group
  const patterns = sorted.map((h) => `(${escapeRegExp(h.text)})`);
  const combined = new RegExp(patterns.join("|"), "gi");

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(combined)) {
    const matchStart = match.index!;
    const matchedText = match[0];

    // Find which hint matched (first non-undefined group)
    let matchedHint: WordHint | undefined;
    for (let i = 0; i < sorted.length; i++) {
      if (match[i + 1] !== undefined) {
        matchedHint = sorted[i];
        break;
      }
    }

    // Add preceding plain text
    if (matchStart > lastIndex) {
      segments.push({ value: text.slice(lastIndex, matchStart) });
    }

    // Add matched segment with hint
    segments.push({
      value: matchedText,
      hint: matchedHint,
    });

    lastIndex = matchStart + matchedText.length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    segments.push({ value: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Check if a flashcard has valid word hints.
 */
export function hasWordHints(wordHints: unknown): boolean {
  return parseWordHints(wordHints).length > 0;
}
