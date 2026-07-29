import type { SmartCard, SmartImportPackage } from "./schema";

export interface FlashcardPackageFeatures {
  hasNormalCards: boolean;
  hasLayeredCards: boolean;
  hasEnrichedFields: boolean;
  hasEmbeddedGlossary: boolean;
  hasWordHints: boolean;
  hasMultipleFolders: boolean;
  hasMultipleLists: boolean;
  normalCardCount: number;
  layeredGroupCount: number;
  glossaryEntryCount: number;
  wordHintCount: number;
}

const ENRICHED_CARD_FIELDS = [
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
  "example",
  "example_translation",
  "context_tag",
  "tags",
  "word_hints",
  "hint",
  "key",
] as const;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function isValidGlossaryEntry(value: unknown): boolean {
  const entry = recordOf(value);
  return Boolean(
    entry
    && typeof entry.term === "string"
    && entry.term.trim()
    && typeof entry.translation === "string"
    && entry.translation.trim(),
  );
}

function isValidCardPair(value: unknown): value is { front: string; back: string } {
  const card = recordOf(value);
  return Boolean(
    card
    && typeof card.front === "string"
    && card.front.trim()
    && typeof card.back === "string"
    && card.back.trim(),
  );
}

export function isValidLayeredCard(card: SmartCard): boolean {
  return card.type === "layered"
    && card.layers.length >= 2
    && card.layers.every(isValidCardPair);
}

function countValidWordHints(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    const hint = recordOf(item);
    return Boolean(
      hint
      && typeof hint.text === "string"
      && hint.text.trim()
      && typeof hint.translation === "string"
      && hint.translation.trim(),
    );
  }).length;
}

function hasEnrichedCardField(card: Record<string, unknown>): boolean {
  return ENRICHED_CARD_FIELDS.some((field) => hasMeaningfulValue(card[field]));
}

export function detectFlashcardPackageFeatures(
  packageValue: Pick<SmartImportPackage, "package"> | null | undefined,
): FlashcardPackageFeatures {
  const folders = packageValue?.package?.folders ?? [];
  const lists = folders.flatMap((folder) => folder.lists);
  let normalCardCount = 0;
  let layeredGroupCount = 0;
  let glossaryEntryCount = 0;
  let wordHintCount = 0;
  let hasEnrichedFields = false;

  for (const list of lists) {
    glossaryEntryCount += list.glossary.filter(isValidGlossaryEntry).length;
    for (const card of list.cards) {
      if (card.type === "normal") {
        normalCardCount += 1;
        wordHintCount += countValidWordHints(card.word_hints);
        hasEnrichedFields ||= hasEnrichedCardField(card as unknown as Record<string, unknown>);
        continue;
      }

      if (!isValidLayeredCard(card)) continue;
      layeredGroupCount += 1;
      wordHintCount += card.layers.reduce((total, layer) => total + countValidWordHints(layer.word_hints), 0);
      hasEnrichedFields ||= hasEnrichedCardField(card as unknown as Record<string, unknown>);
      for (const layer of card.layers) {
        hasEnrichedFields ||= hasEnrichedCardField(layer as unknown as Record<string, unknown>);
      }
    }
  }

  return {
    hasNormalCards: normalCardCount > 0,
    hasLayeredCards: layeredGroupCount > 0,
    hasEnrichedFields,
    hasEmbeddedGlossary: glossaryEntryCount > 0,
    hasWordHints: wordHintCount > 0,
    hasMultipleFolders: folders.length > 1,
    hasMultipleLists: lists.length > 1,
    normalCardCount,
    layeredGroupCount,
    glossaryEntryCount,
    wordHintCount,
  };
}
