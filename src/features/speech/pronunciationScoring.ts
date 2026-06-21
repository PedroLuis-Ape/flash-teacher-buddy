import type { NormalizedPronunciationResult, PronunciationResultKind } from "./types";

export function normalizePronunciationText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

export function textualPronunciationScore(expectedText: string, transcript: string): number {
  const expected = normalizePronunciationText(expectedText);
  const actual = normalizePronunciationText(transcript);
  if (!expected || !actual) return 0;
  const distance = levenshtein(expected, actual);
  return Math.max(0, Math.round((1 - distance / Math.max(expected.length, actual.length)) * 100));
}

export function resultFromScore(score: number): PronunciationResultKind {
  if (score >= 85) return "correct";
  if (score >= 65) return "almost";
  return "incorrect";
}

export function buildTextualPronunciationResult(input: {
  provider: "openai-transcription" | "browser";
  expectedText: string;
  transcript: string;
  confidence?: number | null;
  durationMs?: number | null;
}): NormalizedPronunciationResult {
  const normalizedExpected = normalizePronunciationText(input.expectedText);
  const normalizedTranscript = normalizePronunciationText(input.transcript);
  const score = textualPronunciationScore(input.expectedText, input.transcript);
  const recognizedWords = new Set(normalizedTranscript.split(" ").filter(Boolean));
  return {
    success: true,
    provider: input.provider,
    assessmentType: "textual",
    transcript: input.transcript,
    normalizedTranscript,
    expectedText: input.expectedText,
    normalizedExpected,
    score,
    result: resultFromScore(score),
    confidence: input.confidence ?? null,
    wordResults: normalizedExpected.split(" ").filter(Boolean).map((word) => ({
      word,
      score: recognizedWords.has(word) ? 100 : 0,
      errorType: recognizedWords.has(word) ? null : "missing",
    })),
    accuracyScore: null,
    fluencyScore: null,
    completenessScore: null,
    prosodyScore: null,
    durationMs: input.durationMs ?? null,
    warnings: ["Esta pontuação mede a correspondência da frase reconhecida, não a qualidade acústica da pronúncia."],
  };
}
