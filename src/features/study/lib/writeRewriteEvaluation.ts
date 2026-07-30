import {
  evaluateWriteAnswer,
  normalizeForCompare,
  type WriteAnswerEvaluation,
} from "@/features/study/lib/writeAnswerEvaluation";
import type { WriteCorrectionMode } from "@/features/study/lib/writeCorrectionMode";

/**
 * Reuses the same neutral normalization already applied by the regular Write
 * activity. This keeps both writing activities consistent for harmless
 * differences such as terminal punctuation, accents, casing, apostrophes and
 * repeated spaces.
 */
export function normalizeForRewriteCompare(input: string): string {
  return normalizeForCompare(input);
}

export function evaluateRewriteAnswer(input: {
  userAnswer: string;
  correctAnswer: string;
  mode?: WriteCorrectionMode;
}): WriteAnswerEvaluation {
  const result = evaluateWriteAnswer({
    userAnswer: input.userAnswer,
    correctAnswer: input.correctAnswer,
    alternatives: [],
    mode: input.mode ?? "hard",
  });

  if (result.status === "exact") {
    return {
      ...result,
      summary: "Você reescreveu o texto corretamente.",
    };
  }

  if (result.status === "accepted_with_corrections") {
    return {
      ...result,
      summary: "Sua reescrita foi aceita com pequenos ajustes.",
    };
  }

  return {
    ...result,
    summary: "Reescreva o texto mantendo as mesmas palavras e a mesma ordem.",
  };
}
