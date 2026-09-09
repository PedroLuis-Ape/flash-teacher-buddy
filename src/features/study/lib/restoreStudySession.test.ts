import { describe, expect, it } from "vitest";
import { assertStudySessionWrite, restoreMasterySession, restoreStudySession } from "./restoreStudySession";
import { resolveStudySessionReadiness } from "./studySessionRuntime";
import { createMasterySession, recordResult, validateMasterySessionState } from "./studySessionFlow";

const ids = ["a", "b", "c", "d"];
const answer = { flashcardId: "a", correct: true, skipped: false, attempts: 1 };
const row = { id: "session-x", completed: false, cards_order: ids, current_index: 2 };
const snapshot = { version: 2, sessionId: row.id, cardsOrder: ids, currentIndex: 1, results: [answer] };

describe("ST-empty-order resume regression", () => {
  it("restores a normal incomplete session at the saved card", () => {
    const result = restoreStudySession({ session: row, eligibleIds: ids });
    expect(result.source).toBe("cards_order");
    expect(result.snapshot.cardsOrder[result.snapshot.currentIndex]).toBe("c");
  });
  it("uses the rich snapshot when the legacy column is empty", () => {
    const result = restoreStudySession({ session: { ...row, cards_order: [], session_snapshot: snapshot }, eligibleIds: ids });
    expect(result.source).toBe("session_snapshot");
    expect(result.snapshot).toMatchObject({ currentIndex: 1, results: [answer], sessionId: row.id });
  });
  it("uses cards_order when the rich snapshot is invalid", () => {
    expect(restoreStudySession({ session: { ...row, session_snapshot: { version: 99, cardsOrder: ["d"] } }, eligibleIds: ids }).source).toBe("cards_order");
  });
  it("repairs missing queues without inventing another session", () => {
    const result = restoreStudySession({ session: { ...row, cards_order: [], current_index: 999 }, eligibleIds: ids });
    expect(result.source).toBe("repaired");
    expect(result.snapshot).toMatchObject({ sessionId: row.id, cardsOrder: ids, currentIndex: 3 });
  });
  it("keeps known answered cards before the reconstructed cursor", () => {
    const result = restoreStudySession({ session: { ...row, cards_order: [], session_snapshot: { ...snapshot, cardsOrder: [], results: [answer] } }, eligibleIds: ["b", "a", "c"] });
    expect(result.snapshot).toMatchObject({ cardsOrder: ["a", "b", "c"], currentIndex: 1, results: [answer] });
  });
  it("normalizes invalid indices", () => {
    for (const value of [999, -1, NaN, Infinity, 1.9]) {
      const { snapshot: restored } = restoreStudySession({ session: { ...row, current_index: value }, eligibleIds: ids });
      expect(Number.isInteger(restored.currentIndex)).toBe(true);
      expect(restored.cardsOrder[restored.currentIndex]).toBeTruthy();
    }
  });
  it("keeps the current card when earlier entries were deleted", () => {
    const result = restoreStudySession({ session: { ...row, cards_order: ["deleted", "a", "b", "c"], current_index: 2 }, eligibleIds: ids });
    expect(result.snapshot.cardsOrder[result.snapshot.currentIndex]).toBe("b");
  });
  it("does not substitute a local snapshot from another session", () => {
    expect(restoreStudySession({ session: { ...row, cards_order: [] }, eligibleIds: ids, local: { ...snapshot, sessionId: "session-y" } }).source).toBe("repaired");
    expect(restoreStudySession({ session: { ...row, cards_order: [] }, eligibleIds: ids, local: snapshot }).source).toBe("local");
  });
  it("does not read a foreign session ID embedded in the remote snapshot", () => {
    expect(restoreStudySession({ session: { ...row, session_snapshot: { ...snapshot, sessionId: "session-y" } }, eligibleIds: ids }).source).toBe("cards_order");
  });
  it("prefers a newer same-session local snapshot over an older remote row", () => {
    const result = restoreStudySession({
      session: {
        ...row,
        updated_at: new Date(1_000).toISOString(),
        session_snapshot: { ...snapshot, currentIndex: 1, timestamp: 1_000 },
      },
      local: { ...snapshot, currentIndex: 2, timestamp: 2_000 },
      eligibleIds: ids,
    });
    expect(result.source).toBe("local");
    expect(result.snapshot.currentIndex).toBe(2);
    expect(result.snapshot.results).toEqual([answer]);
  });
  it("restores standard round bookkeeping with the queue", () => {
    const result = restoreStudySession({
      session: {
        ...row,
        session_snapshot: {
          ...snapshot,
          roundNumber: 3,
          roundResults: [answer],
          unseenCards: ["d"],
          missedCards: ["b"],
          isFinished: true,
        },
      },
      eligibleIds: ids,
    });
    expect(result.snapshot).toMatchObject({
      roundNumber: 3,
      roundResults: [answer],
      unseenCards: ["d"],
      missedCards: ["b"],
      isFinished: true,
    });
  });
  it.each(["all", "favorites", "redFocus", "sequential", "random"])("reconciles the final %s deck without importing excluded cards", scope => {
    const eligibleIds = scope === "all" ? ids : ["b", "d"];
    const restored = restoreStudySession({ session: { ...row, cards_order: ["d", "b", "b", "a", "c"], current_index: 1 }, eligibleIds, unique: scope === "redFocus" });
    expect(restored.snapshot.cardsOrder.every(id => eligibleIds.includes(id))).toBe(true);
    expect(restored.snapshot.cardsOrder[restored.snapshot.currentIndex]).toBe("b");
    if (scope === "redFocus") expect(new Set(restored.snapshot.cardsOrder).size).toBe(restored.snapshot.cardsOrder.length);
  });
  it("completed and truly empty sessions use their own readiness states", () => {
    for (const completed of [true, false]) {
      const restored = restoreStudySession({ session: { ...row, completed }, eligibleIds: [] });
      expect(resolveStudySessionReadiness({ pageLoading: false, engineLoading: false, eligibleCardIds: [], cardsOrder: restored.snapshot.cardsOrder, currentIndex: restored.snapshot.currentIndex, isFinished: completed }).phase).toBe(completed ? "completed" : "empty");
    }
  });
  it("slow hydration never classifies an unfinished restore as empty-order", () => {
    for (const loading of ["pageLoading", "engineLoading", "auxiliaryLoading"]) {
      expect(resolveStudySessionReadiness({ pageLoading: false, engineLoading: false, [loading]: true, eligibleCardIds: ids, cardsOrder: [], currentIndex: 0, isFinished: false, recoveryFailed: true }).phase).toBe("loading");
    }
  });
  it("a repaired row survives serialization, exit and two cold restores", () => {
    const first = restoreStudySession({ session: { ...row, cards_order: [] }, eligibleIds: ids });
    const persisted = JSON.parse(JSON.stringify({ ...row, cards_order: first.snapshot.cardsOrder, current_index: first.snapshot.currentIndex, session_snapshot: first.snapshot }));
    const second = restoreStudySession({ session: persisted, eligibleIds: ids });
    const third = restoreStudySession({ session: { ...persisted, session_snapshot: second.snapshot }, eligibleIds: ids });
    expect(third.snapshot.cardsOrder).toEqual(first.snapshot.cardsOrder);
    expect(third.snapshot.currentIndex).toBe(first.snapshot.currentIndex);
    expect(third.snapshot.sessionId).toBe(row.id);
  });
  it("blocks transient empty writes but permits explicit completion", () => {
    for (const payload of [{ cards_order: [] }, { session_snapshot: { cardsOrder: [] } }, { session_snapshot: { currentRoundIds: [] } }]) {
      expect(() => assertStudySessionWrite(payload)).toThrow("study-session-empty-write-blocked");
    }
    expect(() => assertStudySessionWrite({ cards_order: [], completed: true })).not.toThrow();
  });
  it("preserves a valid mastery round and its answer bookkeeping", () => {
    const state = recordResult(createMasterySession(ids, { shuffle: false }), "a", "correct");
    const restored = restoreMasterySession({ ...row, session_snapshot: state }, ids, false);
    expect(restored.currentRoundIndex).toBe(state.currentRoundIndex);
    expect(restored.masteredIds).toEqual(state.masteredIds);
    expect(validateMasterySessionState(restored).valid).toBe(true);
  });
  it("repairs a missing mastery queue without repeating known mastered cards", () => {
    const restored = restoreMasterySession({ ...row, cards_order: [], session_snapshot: { masteredIds: ["a"] } }, ids, false);
    expect(restored.currentRoundIds).not.toContain("a");
    expect(restored.masteredIds).toEqual(["a"]);
    expect(validateMasterySessionState(restored).valid).toBe(true);
  });
});
