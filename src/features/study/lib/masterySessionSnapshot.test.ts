import { describe, expect, it } from "vitest";
import { MASTERY_ROUND_SIZE, type MasterySessionState } from "./studySessionFlow";
import { sanitizeMasterySnapshot } from "./masterySessionSnapshot";

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `c${index + 1}`);
}

function baseSnapshot(): MasterySessionState {
  const currentRoundIds = ids(14);
  return {
    version: 2,
    totalEligible: 28,
    roundSize: 14,
    shuffle: false,
    status: "round-complete",
    roundNumber: 9,
    currentRoundIds,
    currentRoundIndex: currentRoundIds.length,
    // Corrupted legacy state: the same cards stayed in the unseen queue.
    unseenIds: [...currentRoundIds, ...ids(14).map((_, index) => `c${index + 15}`)],
    retryIds: [],
    masteredIds: [...currentRoundIds],
    attemptsByCard: Object.fromEntries(currentRoundIds.map((id) => [id, 2])),
    mistakesByCard: Object.fromEntries(currentRoundIds.map((id) => [id, 1])),
    correctThisRoundIds: [...currentRoundIds],
    failedThisRoundIds: [],
    reviewSourceThisRound: [...currentRoundIds],
    currentRoundResults: Object.fromEntries(currentRoundIds.map((id) => [id, "correct" as const])),
  };
}

describe("sanitizeMasterySnapshot", () => {
  it("removes current/mastered cards from the unseen queue and restores round size", () => {
    const snapshot = baseSnapshot();
    const restored = sanitizeMasterySnapshot(snapshot, new Set(ids(28)));

    expect(restored).not.toBeNull();
    if (!restored) throw new Error("snapshot should be repaired");
    expect(restored.roundSize).toBe(MASTERY_ROUND_SIZE);
    expect(restored.unseenIds).toEqual(ids(14).map((_, index) => `c${index + 15}`));
    expect(restored.unseenIds.some((id) => restored.currentRoundIds.includes(id))).toBe(false);
    expect(restored.status).toBe("round-complete");
  });

  it("finishes a recovered journey instead of offering an empty next round", () => {
    const snapshot = baseSnapshot();
    snapshot.totalEligible = 14;
    snapshot.unseenIds = [...snapshot.currentRoundIds];
    const restored = sanitizeMasterySnapshot(snapshot, new Set(ids(14)));

    expect(restored?.unseenIds).toEqual([]);
    expect(restored?.retryIds).toEqual([]);
    expect(restored?.status).toBe("journey-complete");
  });

  it("removes a stale mastered flag when the current result is a failure", () => {
    const snapshot = baseSnapshot();
    snapshot.currentRoundResults.c1 = "incorrect";

    const restored = sanitizeMasterySnapshot(snapshot, new Set(ids(28)));

    expect(restored).not.toBeNull();
    expect(restored?.masteredIds).not.toContain("c1");
    expect(restored?.correctThisRoundIds).not.toContain("c1");
    expect(restored?.failedThisRoundIds).toContain("c1");
    expect(restored?.status).toBe("round-complete");
  });

  it("repairs duplicate queue entries while keeping the eligible union intact", () => {
    const snapshot = baseSnapshot();
    snapshot.unseenIds = [...snapshot.unseenIds, "c28"];
    snapshot.masteredIds = snapshot.masteredIds.filter((id) => id !== "c1");

    const restored = sanitizeMasterySnapshot(snapshot, new Set(ids(28)));

    expect(restored).not.toBeNull();
    expect(new Set(restored?.unseenIds).size).toBe(restored?.unseenIds.length);
    expect(new Set(restored?.masteredIds).size).toBe(restored?.masteredIds.length);
    expect(restored?.masteredIds).toContain("c1");
  });

  it("turns an unanswered completed-round card into pending work", () => {
    const snapshot = baseSnapshot();
    delete snapshot.currentRoundResults.c14;
    snapshot.correctThisRoundIds = snapshot.correctThisRoundIds.filter((id) => id !== "c14");

    const restored = sanitizeMasterySnapshot(snapshot, new Set(ids(28)));

    expect(restored).not.toBeNull();
    expect(restored?.failedThisRoundIds).toContain("c14");
    expect(restored?.masteredIds).not.toContain("c14");
    expect(restored?.status).toBe("round-complete");
  });

  it("places a newly added card in unseen work", () => {
    const snapshot = baseSnapshot();
    const restored = sanitizeMasterySnapshot(snapshot, new Set([...ids(28), "c29"]));

    expect(restored?.unseenIds).toContain("c29");
    expect(restored?.totalEligible).toBe(29);
  });
});
