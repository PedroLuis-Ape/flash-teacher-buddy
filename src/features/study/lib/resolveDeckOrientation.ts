import {
  classifyLanguageText,
  languageCodesMatch,
  type LanguageScore,
} from "@/lib/languageClassifier";

export interface StudyDeckCardText {
  term: string;
  translation: string;
}

export interface DeckOrientationEvidence {
  inspectedCards: number;
  classifiedCards: number;
  invertedCards: number;
  inversionRatio: number;
  minimumClassifiedCards: number;
  requiredInversionRatio: number;
  samples: Array<{
    term: LanguageScore;
    translation: LanguageScore;
    inverted: boolean;
  }>;
}

export interface DeckOrientation {
  langA: string;
  langB: string;
  inverted: boolean;
  evidence: DeckOrientationEvidence;
}

export const MINIMUM_CLASSIFIED_CARDS = 8;
export const REQUIRED_INVERSION_RATIO = 0.8;

/**
 * Resolve the effective languages for a deck without mutating cards or
 * persisting anything. Both sides of a card must be high-confidence before
 * they can contribute to the aggregate decision.
 */
export function resolveDeckOrientation({
  langA,
  langB,
  cards,
}: {
  langA: string;
  langB: string;
  cards: readonly StudyDeckCardText[];
}): DeckOrientation {
  const samples: DeckOrientationEvidence["samples"] = [];

  for (const card of cards) {
    const term = classifyLanguageText(card.term);
    const translation = classifyLanguageText(card.translation);
    if (!term || !translation || term.confidence !== "high" || translation.confidence !== "high") continue;

    samples.push({
      term,
      translation,
      inverted: languageCodesMatch(term.lang, langB) && languageCodesMatch(translation.lang, langA),
    });
  }

  const invertedCards = samples.filter((sample) => sample.inverted).length;
  const inversionRatio = samples.length > 0 ? invertedCards / samples.length : 0;
  const inverted = languageCodesMatch(langA, langB) === false
    && samples.length >= MINIMUM_CLASSIFIED_CARDS
    && inversionRatio >= REQUIRED_INVERSION_RATIO;

  return {
    langA: inverted ? langB : langA,
    langB: inverted ? langA : langB,
    inverted,
    evidence: {
      inspectedCards: cards.length,
      classifiedCards: samples.length,
      invertedCards,
      inversionRatio,
      minimumClassifiedCards: MINIMUM_CLASSIFIED_CARDS,
      requiredInversionRatio: REQUIRED_INVERSION_RATIO,
      samples: samples.slice(0, 12),
    },
  };
}

/** Keeps custom labels attached to the effective side after a safe inversion. */
export function resolveEffectiveSideLabels({
  labelA,
  labelB,
  inverted,
}: {
  labelA: string;
  labelB: string;
  inverted: boolean;
}): { labelA: string; labelB: string } {
  return inverted ? { labelA: labelB, labelB: labelA } : { labelA, labelB };
}
