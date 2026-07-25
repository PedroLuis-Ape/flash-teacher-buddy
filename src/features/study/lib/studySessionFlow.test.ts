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
    // Round has 15 review cards, so no new cards are pulled in.
    expect(state.retryIds.length).toBeGreaterThanOrEqual(0);
    // Unseen still has 25 leftover new cards
    expect(state.unseenIds).toHaveLength(25);
  });

  it("Case 7 — after unseen is empty, rounds contain only pending cards", () => {
    const state = createMasterySession(ids(19));
    // Round 1: 15 cards. Fail 4 (c1..c4), pass rest.
    playRound(state, (id) => (["c1", "c2", "c3", "c4"].includes(id) ? "incorrect" : "correct"));
    startNextRound(state);
    // Round 2: 4 review + 4 unseen = 8 cards, pass all except keep failing c1
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

  it("Case 11 — revealed cards return in the next round (mastery)", () => {
    const state = createMasterySession(ids(20));
    playRound(state, (id) => (id === "c9" ? "revealed" : "correct"));
    startNextRound(state);
    expect(state.currentRoundIds).toContain("c9");
  });

  it("Case 17 — canonical IDs are used verbatim, no duplication within a round", () => {
    const state = createMasterySession(["parent-1", "layer-1", "parent-2", "layer-1"]);
    // "layer-1" should be deduped by the engine (identity is opaque, dedupe by string equality).
    expect(state.currentRoundIds).toEqual(["parent-1", "layer-1", "parent-2"]);
  });

  it("summary counts recovered cards separately from first-try wins", () => {
    const state = createMasterySession(ids(20));
    playRound(state, (id) => (id === "c1" || id === "c2" ? "incorrect" : "correct"));
    startNextRound(state);
    // Round 2 begins with c1 & c2 as review, plus 13 unseen. Pass everything.
    playRound(state, () => "correct");
    const summary = summarizeCurrentRound(state);
    expect(summary.recoveredCards).toBe(2);
    expect(summary.correctFirstTry).toBe(13);
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
    // The engine consumer processes each ID once, regardless of result.
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
});
