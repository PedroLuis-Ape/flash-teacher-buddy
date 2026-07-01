import { describe, expect, it } from "vitest";
import { buildStudyReturnRoute } from "./lib/studyCompletionNavigation";
import { buildStudySnapshotKey, sanitizeStudySnapshot } from "./lib/studySessionSnapshot";

describe("study return routes", () => {
  it("returns to a private list directly", () => {
    expect(buildStudyReturnRoute({
      pathname: "/list/list-1/study",
      resolvedId: "list-1",
      isListRoute: true,
    })).toBe("/list/list-1");
  });

  it("preserves public classroom context", () => {
    const params = new URLSearchParams({
      guest: "true",
      turma: "turma-1",
      atribuicao: "assignment-1",
      mode: "flip",
      dir: "a-b",
    });
    expect(buildStudyReturnRoute({
      pathname: "/portal/list/list-1/study",
      resolvedId: "list-1",
      isListRoute: true,
      searchParams: params,
    })).toBe("/portal/list/list-1/games?guest=true&turma=turma-1&atribuicao=assignment-1");
  });
});

describe("study snapshots", () => {
  it("restores a compatible deck and clamps the index", () => {
    const snapshot = sanitizeStudySnapshot({
      version: 2,
      sessionId: "session-1",
      currentIndex: 99,
      cardsOrder: ["card-2", "card-1"],
      results: [{ flashcardId: "card-2", correct: true, skipped: false, attempts: 2 }],
      timestamp: 123,
    }, new Set(["card-1", "card-2"]));

    expect(snapshot?.currentIndex).toBe(1);
    expect(snapshot?.cardsOrder).toEqual(["card-2", "card-1"]);
    expect(snapshot?.results[0]?.attempts).toBe(2);
  });

  it("collapses a legacy all-red order to one occurrence per card", () => {
    const snapshot = sanitizeStudySnapshot({
      version: 2,
      sessionId: "red-session",
      currentIndex: 4,
      cardsOrder: ["red-1", "red-2", "red-1", "red-2", "red-1", "red-2"],
      results: [],
      timestamp: 123,
    }, new Set(["red-1", "red-2"]));

    expect(snapshot?.cardsOrder).toEqual(["red-1", "red-2"]);
    expect(snapshot?.currentIndex).toBe(1);
  });

  it("preserves partial red repetitions in a mixed favorites deck", () => {
    const snapshot = sanitizeStudySnapshot({
      version: 2,
      sessionId: "favorites-session",
      currentIndex: 3,
      cardsOrder: ["red-1", "normal-1", "red-1", "red-1"],
      results: [],
      timestamp: 123,
    }, new Set(["red-1", "normal-1"]));

    expect(snapshot?.cardsOrder).toEqual(["red-1", "normal-1", "red-1", "red-1"]);
    expect(snapshot?.currentIndex).toBe(3);
  });

  it("rejects a snapshot from a different deck", () => {
    expect(sanitizeStudySnapshot({
      version: 2,
      sessionId: null,
      currentIndex: 0,
      cardsOrder: ["old-card"],
      results: [],
      timestamp: 123,
    }, new Set(["new-card"]))).toBeNull();
  });

  it("isolates keys by user", () => {
    const base = {
      listId: "list-1",
      mode: "flip",
      sessionScopeKey: "all:random:normal",
      cardsSignature: "a|b",
    };
    expect(buildStudySnapshotKey({ ...base, userScope: "user-1" }))
      .not.toBe(buildStudySnapshotKey({ ...base, userScope: "user-2" }));
  });
});
