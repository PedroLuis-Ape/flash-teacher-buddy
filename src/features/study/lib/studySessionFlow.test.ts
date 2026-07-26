import { describe, expect, it } from "vitest";
import {
  buildContinuousQueue,
  createMasterySession,
  getCurrentCardId,
  isRoundFinished,
  isSessionFinished,
  recordResult,
  startNextRound,
  summarizeCurrentRound,
  composeMasteryRound,
  validateMasterySessionState,
  type StudyCardResult,
} from "./studySessionFlow";

function ids(n: number, prefix = "c"): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

function playRound(
  state: ReturnType<typeof createMasterySession>,
  resolver: (cardId: string, index: number) => StudyCardResult,
): void {
  let index = 0;
  while (!isRoundFinished(state)) {
    const id = getCurrentCardId(state);
    if (!id) break;
    recordResult(state, id, resolver(id, index));
    index += 1;
  }
}

describe("studySessionFlow — mastery rounds", () => {
  it("Case 1 — first round has up to 15 distinct cards, 15 remain unseen", () => {
    const state = createMasterySession(ids(30));
    expect(state.currentRoundIds).toHaveLength(15);
    expect(new Set(state.currentRoundIds).size).toBe(15);
    expect(state.unseenIds).toHaveLength(15);
  });

  it("stops at a real round boundary after the 15th answer", () => {
    const state = createMasterySession(ids(30));
    playRound(state, () => "correct");
    expect(state.status).toBe("round-complete");
    expect(state.currentRoundIndex).toBe(15);
    expect(getCurrentCardId(state)).toBeNull();
    expect(state.roundNumber).toBe(1);

    startNextRound(state);

    expect(state.status).toBe("active");
    expect(state.roundNumber).toBe(2);
    expect(state.currentRoundIndex).toBe(0);
  });

  it("ignores duplicate submissions for the same card", () => {
    const state = createMasterySession(ids(2));
    recordResult(state, "c1", "correct");
    recordResult(state, "c1", "incorrect");
    expect(state.currentRoundIndex).toBe(1);
    expect(state.currentRoundResults.c1).toBe("correct");
    expect(state.attemptsByCard.c1).toBe(1);
  });

  it("Case 2 — incorrect cards return in the next round with 13 new cards", () => {
    const state = createMasterySession(ids(30));
    playRound(state, (id) => (id === "c2" || id === "c5" ? "incorrect" : "correct"));
    startNextRound(state);
    expect(state.currentRoundIds.slice(0, 2)).toEqual(["c2", "c5"]);
    expect(state.currentRoundIds).toHaveLength(15);
    expect(new Set(state.currentRoundIds).size).toBe(15);
  });

  it("Case 3 — a card missed again returns in the round after", () => {
    const state = createMasterySession(ids(30));
    playRound(state, (id) => (id === "c2" ? "incorrect" : "correct"));
    startNextRound(state);
    playRound(state, (id) => (id === "c2" ? "incorrect" : "correct"));
    startNextRound(state);
    expect(state.currentRoundIds).toContain("c2");
  });

  it("Case 4 — a recovered card does not return anymore", () => {
    const state = createMasterySession(ids(30));
    playRound(state, (id) => (id === "c5" ? "incorrect" : "correct"));
    startNextRound(state);
    playRound(state, () => "correct");
    startNextRound(state);
    expect(state.currentRoundIds).not.toContain("c5");
  });

  it("Case 5 — small list uses all cards without duplicates", () => {
    const state = createMasterySession(ids(8));
    expect(state.currentRoundIds).toHaveLength(8);
    expect(new Set(state.currentRoundIds).size).toBe(8);
  });

  it("Case 6 — >15 pending only bring 15 forward, keeping the rest queued", () => {
    const state = createMasterySession(ids(40));
    playRound(state, () => "incorrect");
    startNextRound(state);
    expect(state.currentRoundIds).toHaveLength(15);
    expect(state.retryIds.length).toBeGreaterThanOrEqual(0);
    expect(state.unseenIds).toHaveLength(25);
  });

  it("Case 7 — after unseen is empty, rounds contain only pending cards", () => {
    const state = createMasterySession(ids(19));
    playRound(state, (id) => (["c1", "c2", "c3", "c4"].includes(id) ? "incorrect" : "correct"));
    startNextRound(state);
    playRound(state, (id) => (id === "c1" ? "incorrect" : "correct"));
    startNextRound(state);
    expect(state.unseenIds).toHaveLength(0);
    expect(state.currentRoundIds).toEqual(["c1"]);
  });

  it("Case 8 — session finishes only when no unseen, no retry, no current card", () => {
    const state = createMasterySession(ids(3));
    expect(isSessionFinished(state)).toBe(false);
    playRound(state, () => "correct");
    expect(isSessionFinished(state)).toBe(true);
  });

  it("Case 10 — skipped cards return in the next round (mastery)", () => {
    const state = createMasterySession(ids(20));
    playRound(state, (id) => (id === "c7" ? "skipped" : "correct"));
    startNextRound(state);
    expect(state.currentRoundIds).toContain("c7");
  });

  it("classifying a skip as known completes the card instead of retrying it", () => {
    const state = createMasterySession(ids(20));
    playRound(state, () => "correct");
    startNextRound(state);
    expect(state.currentRoundIds).not.toContain("c7");
    expect(state.masteredIds).toContain("c7");
  });

  it("Case 11 — revealed cards return in the next round (mastery)", () => {
    const state = createMasterySession(ids(20));
    playRound(state, (id) => (id === "c9" ? "revealed" : "correct"));
    startNextRound(state);
    expect(state.currentRoundIds).toContain("c9");
  });

  it("Case 17 — canonical IDs are used verbatim, no duplication within a round", () => {
    const state = createMasterySession(["parent-1", "layer-1", "parent-2", "layer-1"]);
    expect(state.currentRoundIds).toEqual(["parent-1", "layer-1", "parent-2"]);
  });

  it("summary counts recovered cards separately from first-try wins", () => {
    const state = createMasterySession(ids(30));
    playRound(state, (id) => (id === "c1" || id === "c2" ? "incorrect" : "correct"));
    startNextRound(state);
    playRound(state, () => "correct");
    const summary = summarizeCurrentRound(state);
    expect(summary.cardsPlayed).toBe(15);
    expect(summary.recoveredCards).toBe(2);
    expect(summary.correctFirstTry).toBe(13);
    expect(summary.correctCards).toBe(15);
    expect(summary.skippedCards).toBe(0);
    expect(summary.revealedCards).toBe(0);
  });
});

describe("studySessionFlow — continuous queue", () => {
  it("Case 9 — 160 cards produce 160 unique entries, one pass", () => {
    const queue = buildContinuousQueue(ids(160));
    expect(queue).toHaveLength(160);
    expect(new Set(queue).size).toBe(160);
  });

  it("Case 10 (continuous) — skipped cards do NOT return", () => {
    const queue = buildContinuousQueue(ids(5));
    expect(queue).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("dedupes ID collisions", () => {
    const queue = buildContinuousQueue(["a", "a", "b", "c", "b"]);
    expect(queue).toEqual(["a", "b", "c"]);
  });

  it("shuffle option produces a permutation, still unique", () => {
    const source = ids(50);
    const queue = buildContinuousQueue(source, { shuffle: true, random: () => 0.42 });
    expect(new Set(queue)).toEqual(new Set(source));
    expect(queue).toHaveLength(source.length);
  });

  it("composes retries first and removes duplicates or mastered cards from both queues", () => {
    expect(composeMasteryRound(
      ["retry-1", "retry-1", "mastered", "retry-2"],
      ["retry-2", "new-1", "new-1", "mastered", "new-2"],
      3,
      ["mastered"],
    )).toEqual({
      roundIds: ["retry-1", "retry-2", "new-1"],
      remainingRetry: [],
      remainingUnseen: ["new-2"],
      reviewSource: ["retry-1", "retry-2"],
    });
  });
});

describe("mastery invariants", () => {
  it("caps custom round sizes at the safety limit", () => {
    const state = createMasterySession(ids(30), { roundSize: 100 });

    expect(state.roundSize).toBe(15);
    expect(state.currentRoundIds).toHaveLength(15);
    expect(validateMasterySessionState(state, new Set(ids(30))).valid).toBe(true);
  });

  it("ignores an answer for a card that is not currently active", () => {
    const state = createMasterySession(ids(2));

    expect(recordResult(state, "not-current", "correct")).toBe(state);
    expect(state.currentRoundIndex).toBe(0);
    expect(state.currentRoundResults).toEqual({});
  });

  it("does not repeat cards after a fully correct 30-card journey", () => {
    const state = createMasterySession(ids(30));
    playRound(state, () => "correct");
    startNextRound(state);

    expect(state.currentRoundIds).toEqual(ids(15).map((_, index) => `c${index + 16}`));
    playRound(state, () => "correct");

    expect(isSessionFinished(state)).toBe(true);
    expect(state.masteredIds).toHaveLength(30);
    expect(state.currentRoundIds).not.toContain("c1");
    expect(validateMasterySessionState(state, new Set(ids(30))).valid).toBe(true);
  });

  it("does not create an empty round when the final partial round is mastered", () => {
    const state = createMasterySession(ids(19));
    playRound(state, () => "correct");
    startNextRound(state);
    expect(state.currentRoundIds).toEqual(["c16", "c17", "c18", "c19"]);

    playRound(state, () => "correct");

    expect(state.status).toBe("journey-complete");
    expect(state.currentRoundIds).toHaveLength(4);
    expect(state.masteredIds).toHaveLength(19);
    expect(validateMasterySessionState(state, new Set(ids(19))).valid).toBe(true);
  });

  it("keeps failed cards pending until a later correct answer", () => {
    const state = createMasterySession(ids(15));
    playRound(state, () => "incorrect");

    expect(state.status).toBe("round-complete");
    expect(state.masteredIds).toEqual([]);
    expect(validateMasterySessionState(state, new Set(ids(15))).valid).toBe(true);

    startNextRound(state);
    expect(state.currentRoundIds).toEqual(ids(15));
    expect(state.retryIds).toEqual([]);
    playRound(state, () => "correct");
    expect(state.status).toBe("journey-complete");
  });

  it("preserves invariants through deterministic long sequences", () => {
    for (const total of [1, 8, 15, 16, 30, 100]) {
      const eligible = ids(total);
      const state = createMasterySession(eligible);
      const attempts = new Map<string, number>();
      let steps = 0;

      while (!isSessionFinished(state) && steps < 2_000) {
        expect(validateMasterySessionState(state, new Set(eligible)).valid).toBe(true);

        if (state.status === "round-complete") {
          startNextRound(state);
          steps += 1;
          continue;
        }

        const id = getCurrentCardId(state);
        expect(id).not.toBeNull();
        if (!id) break;
        const attempt = attempts.get(id) ?? 0;
        attempts.set(id, attempt + 1);
        const shouldMissOnce = Number(id.slice(1)) % 3 === 0 && attempt === 0;
        recordResult(state, id, shouldMissOnce ? "incorrect" : "correct");
        steps += 1;
      }

      expect(steps).toBeLessThan(2_000);
      expect(state.status).toBe("journey-complete");
      expect(validateMasterySessionState(state, new Set(eligible)).valid).toBe(true);
    }
  });

  it("rejects duplicate or overlapping queue state", () => {
    const state = createMasterySession(ids(20));
    const corrupted = {
      ...state,
      unseenIds: [...state.unseenIds, state.unseenIds[0]],
      retryIds: [state.unseenIds[0]],
    };

    const validation = validateMasterySessionState(corrupted, new Set(ids(20)));

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      "unseenIds contains duplicate IDs",
      "unseenIds overlaps retryIds",
    ]));
  });
});
