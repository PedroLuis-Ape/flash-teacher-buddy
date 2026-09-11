import { describe, expect, it } from "vitest";
import type { WriteAnswerEvaluation } from "./writeAnswerEvaluation";
import {
  beginRewriteAttempt,
  buildRewriteHint,
  createRewriteFlowState,
  retryRewriteAttempt,
  revealNextRewriteHint,
  sanitizeRewriteFlowState,
  submitRewriteAnswer,
  updateRewriteDraft,
} from "./writeRewriteFlow";

const accepted = { accepted: true } satisfies Pick<WriteAnswerEvaluation, "accepted">;
const rejected = { accepted: false } satisfies Pick<WriteAnswerEvaluation, "accepted">;

describe("write Rewrite flow", () => {
  it("completes a correct listening answer on the first attempt", () => {
    const listening = updateRewriteDraft(createRewriteFlowState(), "I am ready");
    const completed = submitRewriteAnswer(listening, listening.draft, accepted);

    expect(completed).toMatchObject({
      phase: "COMPLETED",
      firstAnswer: "I am ready",
      submittedAnswer: "I am ready",
      hadInitialError: false,
    });
  });

  it("forces REVIEW then REWRITE after the first wrong answer", () => {
    const review = submitRewriteAnswer(createRewriteFlowState(), "I ready", rejected);
    expect(review).toMatchObject({
      phase: "REVIEW",
      firstAnswer: "I ready",
      submittedAnswer: "I ready",
      hadInitialError: true,
    });

    const rewrite = beginRewriteAttempt(review);
    expect(rewrite).toMatchObject({ phase: "REWRITE", draft: "", submittedAnswer: null });

    const wrongAgain = submitRewriteAnswer(rewrite, "I is ready", rejected);
    expect(wrongAgain).toMatchObject({ phase: "REWRITE", submittedAnswer: "I is ready" });

    const retry = retryRewriteAttempt(wrongAgain);
    expect(retry).toMatchObject({ phase: "REWRITE", draft: "", submittedAnswer: null });

    const completed = submitRewriteAnswer(retry, "I am ready", accepted);
    expect(completed).toMatchObject({ phase: "COMPLETED", hadInitialError: true });
  });

  it("does not mutate review or completed drafts", () => {
    const review = submitRewriteAnswer(createRewriteFlowState(), "wrong", rejected);
    const completed = submitRewriteAnswer(createRewriteFlowState(), "right", accepted);
    expect(updateRewriteDraft(review, "changed")).toBe(review);
    expect(updateRewriteDraft(completed, "changed")).toBe(completed);
  });

  it("reveals only two progressive hints and never the complete target", () => {
    const first = revealNextRewriteHint(createRewriteFlowState());
    const second = revealNextRewriteHint(first);
    expect(first.hintLevel).toBe(1);
    expect(second.hintLevel).toBe(2);
    expect(revealNextRewriteHint(second)).toBe(second);

    for (const target of ["I", "I am ready", "Olá, mundo!"]) {
      expect(buildRewriteHint(target, 1)).not.toBe(target);
      expect(buildRewriteHint(target, 2)).not.toBe(target);
    }
  });

  it("rejects malformed persisted states", () => {
    expect(sanitizeRewriteFlowState(null)).toBeNull();
    expect(sanitizeRewriteFlowState({ ...createRewriteFlowState(), phase: "UNKNOWN" })).toBeNull();
    expect(sanitizeRewriteFlowState({ ...createRewriteFlowState(), hintLevel: 3 })).toBeNull();
    expect(sanitizeRewriteFlowState(createRewriteFlowState())).toEqual(createRewriteFlowState());
  });
});