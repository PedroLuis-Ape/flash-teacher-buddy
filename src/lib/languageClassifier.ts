/**
 * Small, deterministic language classifier shared by study runtime and the
 * A/B consistency audit. It intentionally mirrors the audit's heuristic:
 * accented-character evidence is worth 3 points and matching words are worth
 * 2 points. This is a conservative signal, not a general-purpose translator.
 */

export type LanguageConfidence = "high" | "medium" | "low";

export interface LanguageScore {
  lang: string;
  score: number;
  confidence: LanguageConfidence;
}

const LANG_PATTERNS: Record<string, { chars: RegExp; words: readonly string[] }> = {
  pt: {
    chars: /[ãõçáéíóúâêôà]/i,
    words: ["de", "que", "não", "para", "uma", "com", "ele", "ela", "você", "eu", "nós", "são", "está", "ter", "ser", "fazer", "como", "mais", "muito", "bem", "mas", "por"],
  },
  en: {
    chars: /\b(the|is|are|was|were|have|has|had|will|would|could|should|can|do|does|did|don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't|can't|it's|that's|there's|what's|he's|she's|I'm|you're|we're|they're|I've|you've|we've|they've)\b/i,
    words: ["the", "is", "are", "was", "were", "have", "has", "had", "will", "would", "could", "should", "can", "this", "that", "with", "from", "they", "been", "some", "what", "when", "your", "which"],
  },
  fr: {
    chars: /[éèêëàâùûüîïôœæç]/i,
    words: ["le", "la", "les", "des", "est", "sont", "une", "dans", "pour", "avec", "que", "qui", "sur", "par", "pas", "mais", "nous", "vous", "ils", "elles", "être", "avoir", "faire", "cette", "ces", "tout", "c'est", "j'ai", "je"],
  },
  es: {
    chars: /[ñ¿¡áéíóúü]/i,
    words: ["el", "la", "los", "las", "es", "son", "una", "con", "que", "para", "por", "está", "pero", "como", "más", "todo", "esta", "cuando", "también", "puede", "hace", "desde", "donde", "tiene"],
  },
  de: {
    chars: /[äöüß]/i,
    words: ["der", "die", "das", "ist", "und", "ein", "eine", "nicht", "mit", "auf", "für", "sich", "den", "dem", "ich", "wir", "sie", "haben", "werden", "sein"],
  },
  it: {
    chars: /[àèéìíòóùú]/i,
    words: ["il", "la", "che", "di", "non", "una", "per", "sono", "con", "gli", "questo", "anche", "come", "della", "più", "fatto", "essere", "hanno", "quando", "tutto"],
  },
};

/** Returns the base ISO-like language code for short or regional metadata. */
export function getLanguageBaseCode(code: string | null | undefined): string {
  return String(code ?? "").trim().toLowerCase().replace(/_/g, "-").split("-")[0];
}

/** Compares a detected short language code with list metadata. */
export function languageCodesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftBase = getLanguageBaseCode(left);
  const rightBase = getLanguageBaseCode(right);
  return Boolean(leftBase && rightBase && leftBase === rightBase);
}

/**
 * Classifies one piece of text using the exact score/confidence thresholds
 * used by audit-ab-consistency. Low-confidence evidence is returned so
 * callers can decide whether their aggregate policy should ignore it.
 */
export function classifyLanguageText(text: string | null | undefined): LanguageScore | null {
  if (typeof text !== "string" || text.trim().length < 3 || !/\p{L}/u.test(text)) return null;

  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/u);
  const scores: Record<string, number> = {};

  for (const [lang, patterns] of Object.entries(LANG_PATTERNS)) {
    let score = 0;
    if (patterns.chars.test(normalized)) score += 3;
    for (const word of words) {
      if (patterns.words.includes(word)) score += 2;
    }
    scores[lang] = score;
  }

  const entries = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  if (entries.length === 0 || entries[0][1] === 0) return null;

  const topScore = entries[0][1];
  const secondScore = entries[1]?.[1] ?? 0;
  const confidence: LanguageConfidence = topScore >= 6 && topScore > secondScore * 2
    ? "high"
    : topScore >= 3 && topScore > secondScore
      ? "medium"
      : "low";

  return { lang: entries[0][0], score: topScore, confidence };
}
