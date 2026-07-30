import {
  evaluateWriteAnswer,
  type WriteAnswerEvaluation,
} from "@/features/study/lib/writeAnswerEvaluation";

const TYPOGRAPHIC_APOSTROPHES = /[’‘ʼ`´\u02bc\uff07]/g;
const TYPOGRAPHIC_DOUBLE_QUOTES = /[“”«»]/g;
const UNUSUAL_SPACES = /[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g;

/**
 * Exact-copy comparison used by the Reescrever activity.
 *
 * It preserves letters, casing, accents and punctuation. Only harmless input
 * differences created by browsers/mobile keyboards are normalized:
 * - Unicode composition (NFC)
 * - straight/typographic apostrophes and quotation marks
 * - line endings and repeated whitespace
 */
export function normalizeForRewriteCompare(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(TYPOGRAPHIC_APOSTROPHES, "'")
    .replace(TYPOGRAPHIC_DOUBLE_QUOTES, '"')
    .replace(UNUSUAL_SPACES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateRewriteAnswer(input: {
  userAnswer: string;
  correctAnswer: string;
}): WriteAnswerEvaluation {
  const strictUser = normalizeForRewriteCompare(input.userAnswer);
  const strictReference = normalizeForRewriteCompare(input.correctAnswer);
  const base = evaluateWriteAnswer({
    userAnswer: input.userAnswer,
    correctAnswer: input.correctAnswer,
    alternatives: [],
    mode: "hard",
  });

  if (strictUser.length > 0 && strictUser === strictReference) {
    return {
      ...base,
      status: "exact",
      accepted: true,
      accuracy: 1,
      characterSimilarity: 1,
      wordAccuracy: 1,
      summary: "Você reescreveu o texto corretamente.",
    };
  }

  const formattingOnly = base.status === "exact";
  return {
    ...base,
    status: "incorrect",
    accepted: false,
    summary: formattingOnly
      ? "O texto está quase igual. Confira maiúsculas, acentos e pontuação."
      : "Reescreva o texto exatamente como ele aparece acima.",
  };
}
