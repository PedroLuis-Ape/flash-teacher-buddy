/**
 * Centralized study-side resolution utility.
 *
 * Given two sides (A = term/front, B = translation/back) and a direction,
 * returns which side is the "prompt" (shown first / question) and which is
 * the "answer" (shown second / expected response).
 *
 * Convention:
 *   sideA  = front = term      = lang_a  (e.g. English)
 *   sideB  = back  = translation = lang_b  (e.g. Portuguese)
 *
 * Direction semantics:
 *   "pt-en"  → show B first (Portuguese prompt), answer with A (English)
 *   "en-pt"  → show A first (English prompt),    answer with B (Portuguese)
 *   "any"    → deterministic pseudo-random per card
 */

export interface StudySide {
  text: string;
  lang: string;
  label: string;
  /** Only used by WriteStudyView */
  acceptedAnswers?: string[];
}

export interface ResolvedSides {
  promptSide: StudySide;
  answerSide: StudySide;
  /** true when sideA is the prompt (i.e. "en-pt" direction) */
  isAFirst: boolean;
}

/**
 * Deterministic hash-based boolean for "any" direction.
 * Returns true (= sideA first) or false (= sideB first).
 */
function hashToBool(seed: string): boolean {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 2 === 0;
}

/**
 * Main resolver – single source of truth for all study components.
 *
 * @param sideA  - Object built from `front` / `langA` / `labelA`
 * @param sideB  - Object built from `back`  / `langB` / `labelB`
 * @param direction - "pt-en" | "en-pt" | "any"
 * @param cardSeed  - A stable per-card string (e.g. flashcardId or front text)
 *                    used only when direction === "any"
 */
export function resolveStudySides(
  sideA: StudySide,
  sideB: StudySide,
  direction: "pt-en" | "en-pt" | "any",
  cardSeed: string = ""
): ResolvedSides {
  let isAFirst: boolean;

  if (direction === "en-pt") {
    // English (A) first → Portuguese (B) answer
    isAFirst = true;
  } else if (direction === "pt-en") {
    // Portuguese (B) first → English (A) answer
    isAFirst = false;
  } else {
    // "any" – deterministic pseudo-random
    isAFirst = hashToBool(cardSeed);
  }

  return {
    promptSide: isAFirst ? sideA : sideB,
    answerSide: isAFirst ? sideB : sideA,
    isAFirst,
  };
}

/**
 * Shared BCP-47 mapper – avoids duplicating the map in every component.
 */
const BCP47_MAP: Record<string, string> = {
  en: "en-US", pt: "pt-BR", es: "es-ES", fr: "fr-FR",
  de: "de-DE", it: "it-IT", ja: "ja-JP", zh: "zh-CN",
  ko: "ko-KR", ru: "ru-RU", ar: "ar-SA", hi: "hi-IN",
};

export function toBCP47(code: string): string {
  return BCP47_MAP[code] || code;
}

/**
 * Shared label mapper – avoids duplicating the map in every component.
 */
const LANG_LABELS: Record<string, string> = {
  en: "English", pt: "Português", es: "Español", fr: "Français",
  de: "Deutsch", it: "Italiano", ja: "日本語", zh: "中文",
  ko: "한국어", ru: "Русский", ar: "العربية", hi: "हिन्दी",
};

export function getLangLabel(code: string): string {
  return LANG_LABELS[code] || code.toUpperCase();
}
