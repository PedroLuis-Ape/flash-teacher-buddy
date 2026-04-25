/**
 * Word Hints — utility for matching and highlighting word/expression hints in text.
 *
 * A WordHint is a user-authored annotation linking a word or expression
 * in the original text to its translation + optional note.
 *
 * Supports two modes:
 * 1. INDEX-BASED (preferred): hints include startIndex/endIndex for exact positioning
 * 2. REGEX-BASED (legacy fallback): hints with only text field use regex matching
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
  /** Start character index in source text (inclusive) */
  startIndex?: number;
  /** End character index in source text (exclusive) */
  endIndex?: number;
  /**
   * Which side of the card this hint belongs to.
   * "A" = term (default for legacy hints)
   * "B" = translation
   * Backward-compatible: undefined is treated as "A".
   */
  side?: "A" | "B";
}

/** A segment of text that may or may not have a hint attached */
export interface TextSegment {
  /** The text content of this segment */
  value: string;
  /** If this segment matches a hint, the hint object */
  hint?: WordHint;
}

/** Result of validating hint indices against current text */
export interface HintValidation {
  hint: WordHint;
  valid: boolean;
  /** The text at the stored indices in the current source */
  foundText?: string;
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
 * Check if a hint has valid index-based binding.
 */
function hasValidIndices(hint: WordHint): boolean {
  return (
    typeof hint.startIndex === "number" &&
    typeof hint.endIndex === "number" &&
    hint.startIndex >= 0 &&
    hint.endIndex > hint.startIndex
  );
}

/**
 * Check if ALL hints in the array have valid indices.
 */
function allHintsHaveIndices(hints: WordHint[]): boolean {
  return hints.length > 0 && hints.every(hasValidIndices);
}

/**
 * Segment text using exact index positions (no regex).
 * Hints are sorted by startIndex. Overlapping ranges are handled
 * by processing in order and skipping any hint whose range
 * overlaps with an already-processed one.
 */
export function segmentTextByIndex(text: string, hints: WordHint[]): TextSegment[] {
  if (!text || hints.length === 0) return [{ value: text || "" }];

  // Sort by startIndex ascending; longer ranges first for same start
  const sorted = [...hints]
    .filter(hasValidIndices)
    .sort((a, b) => a.startIndex! - b.startIndex! || (b.endIndex! - b.startIndex!) - (a.endIndex! - a.startIndex!));

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const hint of sorted) {
    const start = hint.startIndex!;
    const end = Math.min(hint.endIndex!, text.length);

    // Skip if out of bounds
    if (start >= text.length || end > text.length) continue;

    // Skip if text at position doesn't match hint text (e.g. hint from other side)
    const sliced = text.slice(start, end);
    if (sliced.toLowerCase() !== hint.text.toLowerCase()) continue;

    // Skip if this hint's range is before cursor (overlap with previous)
    if (start < cursor) continue;

    // Add plain text before this hint
    if (start > cursor) {
      segments.push({ value: text.slice(cursor, start) });
    }

    // Add the hinted segment
    segments.push({
      value: text.slice(start, end),
      hint,
    });

    cursor = end;
  }

  // Add remaining plain text
  if (cursor < text.length) {
    segments.push({ value: text.slice(cursor) });
  }

  return segments;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split text into segments, matching hints longest-first (legacy regex mode).
 * Punctuation-tolerant: "market," will match hint "market".
 *
 * @param text - The full text to segment
 * @param hints - Array of WordHint objects
 * @returns Array of TextSegment objects in order
 */
function segmentTextByRegex(text: string, hints: WordHint[]): TextSegment[] {
  if (!text || !hints || hints.length === 0) {
    return [{ value: text || "" }];
  }

  // Sort by length descending so longer expressions match first
  const sorted = [...hints].sort((a, b) => b.text.length - a.text.length);

  // Build a combined regex with word boundaries (tolerant of trailing punctuation)
  const patterns = sorted.map((h) => `(\\b${escapeRegExp(h.text)}\\b)`);
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
 * Main segmentation function — auto-detects index vs regex mode.
 * If all hints have valid startIndex/endIndex → uses exact index slicing.
 * Otherwise → falls back to regex matching (legacy).
 */
export function segmentText(text: string, hints: WordHint[]): TextSegment[] {
  if (!text || !hints || hints.length === 0) {
    return [{ value: text || "" }];
  }

  if (allHintsHaveIndices(hints)) {
    return segmentTextByIndex(text, hints);
  }

  return segmentTextByRegex(text, hints);
}

/**
 * Validate hint indices against the current text.
 * Returns validation result for each hint.
 */
export function validateHintIndices(text: string, hints: WordHint[]): HintValidation[] {
  return hints.map((hint) => {
    if (!hasValidIndices(hint)) {
      return { hint, valid: false };
    }

    const start = hint.startIndex!;
    const end = hint.endIndex!;

    // Out of bounds
    if (start >= text.length || end > text.length) {
      return { hint, valid: false, foundText: "" };
    }

    const foundText = text.slice(start, end);
    const valid = foundText.toLowerCase() === hint.text.toLowerCase();

    return { hint, valid, foundText };
  });
}

/**
 * Attempt to revalidate hints after a text edit.
 * Tries to find each hint's text at its stored position first,
 * then searches the entire new text for a match.
 * Returns updated hints with corrected indices where possible,
 * or marks them as needing manual review (removes indices).
 */
export function revalidateHints(newText: string, hints: WordHint[]): WordHint[] {
  return hints.map((hint) => {
    if (!hasValidIndices(hint)) return hint;

    const start = hint.startIndex!;
    const end = hint.endIndex!;

    // Check if text at original position still matches
    if (start < newText.length && end <= newText.length) {
      const atPosition = newText.slice(start, end);
      if (atPosition.toLowerCase() === hint.text.toLowerCase()) {
        return { ...hint, text: atPosition }; // Keep indices, update text case
      }
    }

    // Try to find the text elsewhere in the new string (first occurrence)
    const lowerNew = newText.toLowerCase();
    const lowerHint = hint.text.toLowerCase();
    const newStart = lowerNew.indexOf(lowerHint);

    if (newStart !== -1) {
      return {
        ...hint,
        text: newText.slice(newStart, newStart + hint.text.length),
        startIndex: newStart,
        endIndex: newStart + hint.text.length,
      };
    }

    // Could not find — strip indices, mark for manual review
    const { startIndex, endIndex, ...rest } = hint;
    return rest;
  });
}

/**
 * Check if a flashcard has valid word hints.
 */
export function hasWordHints(wordHints: unknown): boolean {
  return parseWordHints(wordHints).length > 0;
}
