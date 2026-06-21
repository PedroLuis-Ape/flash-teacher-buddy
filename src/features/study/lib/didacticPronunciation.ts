import { segmentTextForTTS } from "./speechSegmentation";

export interface DidacticPronunciationEntry {
  /** Beginner-friendly visual approximation. This is not IPA. */
  display: string;
  /** Small English chunks sent separately to the browser voice. */
  speechParts: string[];
  /** Zero-based chunk that carries the main stress. */
  stressIndex: number;
}

export interface DidacticSpeechStep {
  text: string;
  rate: number;
  pitch: number;
  pauseAfterMs: number;
  kind: "word" | "chunk" | "review";
}

const ENGLISH_DIDACTIC_PRONUNCIATION: Record<string, DidacticPronunciationEntry> = {};

function normalizeLookupWord(word: string): string {
  return word
    .toLocaleLowerCase("en-US")
    .replace(/^[^a-z]+|[^a-z]+$/g, "");
}

export function getDidacticPronunciation(
  word: string,
  lang: string,
): DidacticPronunciationEntry | null {
  if (!lang.toLocaleLowerCase().startsWith("en")) return null;
  return ENGLISH_DIDACTIC_PRONUNCIATION[normalizeLookupWord(word)] ?? null;
}

/**
 * Some native voices announce isolated uppercase tokens as character names
 * (for example, "capital I") instead of reading them as words. The didactic
 * mode sends every token separately, so lexical one-letter words need an
 * unambiguous spoken surrogate.
 */
function getSpokenWord(word: string, lang: string): string {
  if (!lang.toLocaleLowerCase().startsWith("en")) return word;

  const normalized = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  if (normalized === "I") return "eye";
  if (normalized.toLocaleLowerCase("en-US") === "a") return "uh";

  return word;
}

function regularWordStep(word: string, lang: string): DidacticSpeechStep {
  return {
    text: getSpokenWord(word, lang),
    rate: 0.72,
    pitch: 1,
    pauseAfterMs: 350,
    kind: "word",
  };
}

/**
 * Builds slow playback by separating the words of a phrase.
 * Each individual word remains intact and is never split into syllables.
 */
export function buildDidacticSpeechPlan(
  text: string,
  lang: string,
): DidacticSpeechStep[] {
  const words = segmentTextForTTS(text);
  const plan = words.map((word) => regularWordStep(word, lang));

  if (plan.length > 0) {
    plan[plan.length - 1] = {
      ...plan[plan.length - 1],
      pauseAfterMs: 0,
    };
  }

  return plan;
}
