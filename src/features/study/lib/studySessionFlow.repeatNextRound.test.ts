import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeMasterySnapshot } from "./masterySessionSnapshot";
import {
  requestMasteryRepeatNextRound,
  resetMasteryRepeatRequestForTests,
  setMasteryRepeatEnabled,
} from "./masteryRepeatRequest";
import {
  createMasterySession,
  getCurrentCardId,
  recordResult,
  startNextRound,
  summarizeCurrentRound,
} from "./studySessionFlow";

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `c${index + 1}`);
}

function answerCurrentCorrect(state: ReturnType<typeof createMasterySession>): void {
  const cardId = getCurrentCardId(state);
  if (!cardId) throw new Error("Expected an active mastery card");
  recordResult(state, cardId, "correct");
}

describe("Rodadas de Domínio — repetir na próxima", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMasteryRepeatRequestForTests();
    setMasteryRepeatEnabled(true);
  });

  afterEach(() => {
    resetMasteryRepeatRequestForTests();
    vi.useRealTimers();
  });

  it("counts the answer as correct but keeps the card pending for exactly the next round", () => {
    const eligibleIds = ids(20);
    const state = createMasterySession(eligibleIds);

    expect(getCurrentCardId(state)).toBe("c1");
    expect(requestMasteryRepeatNextRound()).toBe(true);
    recordResult(state, "c1", "correct");

    while ((state.status as string) === "active") answerCurrentCorrect(state);

    const summary = summarizeCurrentRound(state);
    expect(summary.correctCards).toBe(15);
    expect(summary.requestedRepeatCards).toBe(1);
    expect(summary.masteredTotal).toBe(14);
    expect(state.currentRoundResults.c1).toBe("correct-repeat");
    expect(state.failedThisRoundIds).toEqual(["c1"]);
    expect(state.masteredIds).not.toContain("c1");
    expect(state.mistakesByCard.c1).toBeUndefined();
    expect(state.status).toBe("round-complete");

    const restored = sanitizeMasterySnapshot(state, new Set(eligibleIds));
    expect(restored).not.toBeNull();
    expect(restored?.currentRoundResults.c1).toBe("correct-repeat");
    expect(restored?.failedThisRoundIds).toContain("c1");
    expect(restored?.masteredIds).not.toContain("c1");

    startNextRound(state);
    expect(state.currentRoundIds).toEqual(["c1", "c16", "c17", "c18", "c19", "c20"]);
    expect(new Set(state.currentRoundIds).size).toBe(state.currentRoundIds.length);

    while (state.status === "active") answerCurrentCorrect(state);

    expect(state.status).toBe("journey-complete");
    expect(new Set(state.masteredIds).size).toBe(20);
  });

  it("allows the learner to request another confirmation on a later round", () => {
    const state = createMasterySession(["only-card"]);

    expect(requestMasteryRepeatNextRound()).toBe(true);
    recordResult(state, "only-card", "correct");
    expect(state.status).toBe("round-complete");

    startNextRound(state);
    expect(state.currentRoundIds).toEqual(["only-card"]);

    expect(requestMasteryRepeatNextRound()).toBe(true);
    recordResult(state, "only-card", "correct");
    expect(state.status).toBe("round-complete");

    startNextRound(state);
    expect(state.currentRoundIds).toEqual(["only-card"]);

    recordResult(state, "only-card", "correct");
    expect(state.status).toBe("journey-complete");
    expect(state.masteredIds).toEqual(["only-card"]);
  });

  it("does not turn an explicit correct-repeat result into a mistake", () => {
    const state = createMasterySession(["c1", "c2"]);

    recordResult(state, "c1", "correct-repeat");

    expect(state.correctThisRoundIds).toContain("c1");
    expect(state.failedThisRoundIds).toContain("c1");
    expect(state.mistakesByCard.c1).toBeUndefined();
    expect(summarizeCurrentRound(state).correctCards).toBe(1);
    expect(summarizeCurrentRound(state).incorrectCards).toBe(0);
  });
});
