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

/**
 * Curated beginner-oriented decompositions.
 *
 * Browser TTS does not offer reliable phoneme control across devices. These
 * entries therefore use short English-readable chunks to make reductions and
 * stressed syllables easier to hear, followed by the natural word again so the
 * learner does not memorize an artificial segmented pronunciation.
 */
const ENGLISH_DIDACTIC_PRONUNCIATION: Record<string, DidacticPronunciationEntry> = {
  important: {
    display: "im-POR-tənt",
    speechParts: ["im", "port", "ent"],
    stressIndex: 1,
  },
  comfortable: {
    display: "COMF-tər-bəl",
    speechParts: ["comf", "ter", "bull"],
    stressIndex: 0,
  },
  interesting: {
    display: "IN-trə-sting",
    speechParts: ["in", "truh", "sting"],
    stressIndex: 0,
  },
  different: {
    display: "DIF-rənt",
    speechParts: ["diff", "rent"],
    stressIndex: 0,
  },
  favorite: {
    display: "FAY-və-rit",
    speechParts: ["fay", "vuh", "rit"],
    stressIndex: 0,
  },
  vegetable: {
    display: "VEJ-tə-bəl",
    speechParts: ["vej", "tuh", "bull"],
    stressIndex: 0,
  },
  probably: {
    display: "PROB-ə-blee",
    speechParts: ["prob", "uh", "blee"],
    stressIndex: 0,
  },
  family: {
    display: "FAM-ə-lee",
    speechParts: ["fam", "uh", "lee"],
    stressIndex: 0,
  },
  chocolate: {
    display: "CHOK-lət",
    speechParts: ["chock", "lit"],
    stressIndex: 0,
  },
  restaurant: {
    display: "RES-trənt",
    speechParts: ["res", "trunt"],
    stressIndex: 0,
  },
};

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

function chunkSteps(entry: DidacticPronunciationEntry): DidacticSpeechStep[] {
  return entry.speechParts.map((part, index) => ({
    text: part,
    rate: index === entry.stressIndex ? 0.76 : 0.68,
    pitch: index === entry.stressIndex ? 1.06 : 1,
    pauseAfterMs: index === entry.speechParts.length - 1 ? 260 : 240,
    kind: "chunk" as const,
  }));
}

/**
 * Builds the slow/didactic playback plan.
 *
 * Unknown words keep the existing word-by-word behavior. Curated difficult
 * English words are articulated in chunks and then repeated naturally. When a
 * card contains only one difficult word, the natural word is also played first
 * so the learner hears: whole word → chunks → whole word.
 */
export function buildDidacticSpeechPlan(
  text: string,
  lang: string,
): DidacticSpeechStep[] {
  const words = segmentTextForTTS(text);
  if (words.length === 0) return [];

  const onlyOneWord = words.length === 1;
  const plan: DidacticSpeechStep[] = [];

  words.forEach((word) => {
    const entry = getDidacticPronunciation(word, lang);
    if (!entry) {
      plan.push(regularWordStep(word));
      return;
    }

    if (onlyOneWord) {
      plan.push({
        text: word,
        rate: 0.82,
        pitch: 1,
        pauseAfterMs: 320,
        kind: "word",
      });
    }

    plan.push(...chunkSteps(entry));
    plan.push({
      text: word,
      rate: 0.88,
      pitch: 1,
      pauseAfterMs: 420,
      kind: "review",
    });
  });

  if (plan.length > 0) {
    plan[plan.length - 1] = {
      ...plan[plan.length - 1],
      pauseAfterMs: 0,
    };
  }

  return plan;
}
