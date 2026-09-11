import type { WriteAnswerEvaluation } from "./writeAnswerEvaluation";

export type RewritePhase = "LISTENING" | "REVIEW" | "REWRITE" | "COMPLETED";

export interface RewriteFlowState {
  phase: RewritePhase;
  draft: string;
  firstAnswer: string | null;
  submittedAnswer: string | null;
  hintLevel: 0 | 1 | 2;
  hadInitialError: boolean;
}

export const INITIAL_REWRITE_FLOW_STATE: RewriteFlowState = Object.freeze({
  phase: "LISTENING",
  draft: "",
  firstAnswer: null,
  submittedAnswer: null,
  hintLevel: 0,
  hadInitialError: false,
});

export function createRewriteFlowState(): RewriteFlowState {
  return { ...INITIAL_REWRITE_FLOW_STATE };
}

export function updateRewriteDraft(state: RewriteFlowState, draft: string): RewriteFlowState {
  if (state.phase === "REVIEW" || state.phase === "COMPLETED") return state;
  return { ...state, draft, submittedAnswer: null };
}

export function revealNextRewriteHint(state: RewriteFlowState): RewriteFlowState {
  if (state.phase !== "LISTENING" || state.hintLevel >= 2) return state;
  return { ...state, hintLevel: state.hintLevel === 0 ? 1 : 2 };
}

export function submitRewriteAnswer(
  state: RewriteFlowState,
  answer: string,
  evaluation: Pick<WriteAnswerEvaluation, "accepted">,
): RewriteFlowState {
  const submitted = answer.trim();
  if (!submitted || state.phase === "REVIEW" || state.phase === "COMPLETED") return state;

  if (state.phase === "LISTENING") {
    return evaluation.accepted
      ? {
          ...state,
          phase: "COMPLETED",
          draft: submitted,
          firstAnswer: submitted,
          submittedAnswer: submitted,
        }
      : {
          ...state,
          phase: "REVIEW",
          draft: submitted,
          firstAnswer: submitted,
          submittedAnswer: submitted,
          hadInitialError: true,
        };
  }

  return evaluation.accepted
    ? { ...state, phase: "COMPLETED", draft: submitted, submittedAnswer: submitted }
    : { ...state, draft: submitted, submittedAnswer: submitted };
}

export function beginRewriteAttempt(state: RewriteFlowState): RewriteFlowState {
  if (state.phase !== "REVIEW") return state;
  return { ...state, phase: "REWRITE", draft: "", submittedAnswer: null };
}

export function retryRewriteAttempt(state: RewriteFlowState): RewriteFlowState {
  if (state.phase !== "REWRITE" || !state.submittedAnswer) return state;
  return { ...state, draft: "", submittedAnswer: null };
}

/** Progressive listening hints intentionally never contain the complete target. */
export function buildRewriteHint(target: string, level: 0 | 1 | 2): string {
  if (level === 0) return "";
  const words = target.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "";
  if (level === 1) {
    return `${words.length} palavra${words.length === 1 ? "" : "s"} · começa com “${words[0].charAt(0)}”`;
  }
  return words
    .map((word) => {
      const letters = Array.from(word).filter((character) => /[\p{L}\p{N}]/u.test(character));
      return letters.length > 0 ? `${letters[0]}${"_".repeat(Math.max(letters.length - 1, 0))}` : "_";
    })
    .join(" ");
}

export function sanitizeRewriteFlowState(value: unknown): RewriteFlowState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<RewriteFlowState>;
  if (
    row.phase !== "LISTENING"
    && row.phase !== "REVIEW"
    && row.phase !== "REWRITE"
    && row.phase !== "COMPLETED"
  ) return null;
  if (typeof row.draft !== "string" || row.draft.length > 20_000) return null;
  if (row.firstAnswer !== null && typeof row.firstAnswer !== "string") return null;
  if (row.submittedAnswer !== null && typeof row.submittedAnswer !== "string") return null;
  if (row.hintLevel !== 0 && row.hintLevel !== 1 && row.hintLevel !== 2) return null;
  if (typeof row.hadInitialError !== "boolean") return null;
  return {
    phase: row.phase,
    draft: row.draft,
    firstAnswer: row.firstAnswer ?? null,
    submittedAnswer: row.submittedAnswer ?? null,
    hintLevel: row.hintLevel,
    hadInitialError: row.hadInitialError,
  };
}