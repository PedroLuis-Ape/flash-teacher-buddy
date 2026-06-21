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

function regularWordStep(word: string): DidacticSpeechStep {
  return {
    text: word,
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
  void lang;
  const words = segmentTextForTTS(text);
  const plan = words.map(regularWordStep);

  if (plan.length > 0) {
    plan[plan.length - 1] = {
      ...plan[plan.length - 1],
      pauseAfterMs: 0,
    };
  }

  return plan;
}
