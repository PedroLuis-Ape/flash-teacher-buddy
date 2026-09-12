import { describe, expect, it } from "vitest";
import { buildStudyReturnRoute } from "./lib/studyCompletionNavigation";
import { buildStudySnapshotKey, sanitizeStudySnapshot } from "./lib/studySessionSnapshot";
import * as studySessionSnapshotModule from "./lib/studySessionSnapshot";

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

  it("repairs a restored red-focus database queue to one sequential occurrence per card", () => {
    type Sanitizer = (input: {
      sessionOrder: unknown;
      currentIndex: unknown;
      availableCardIds: ReadonlySet<string>;
      enforceUniqueOrder: boolean;
    }) => {
      cardsOrder: string[];
      currentIndex: number;
      repaired: boolean;
    } | null;

    const sanitizePersistedStudyOrder = (
      studySessionSnapshotModule as unknown as { sanitizePersistedStudyOrder?: Sanitizer }
    ).sanitizePersistedStudyOrder;

    expect(sanitizePersistedStudyOrder).toBeTypeOf("function");

    const restored = sanitizePersistedStudyOrder?.({
      sessionOrder: ["red-2", "red-1", "red-3", "red-2", "red-1", "red-3"],
      currentIndex: 5,
      availableCardIds: new Set(["red-1", "red-2", "red-3"]),
      enforceUniqueOrder: true,
    });

    expect(restored).toEqual({
      cardsOrder: ["red-1", "red-2", "red-3"],
      currentIndex: 0,
      repaired: true,
    });
  });

  it("preserves repeated cards outside red focus", () => {
    type Sanitizer = (input: {
      sessionOrder: unknown;
      currentIndex: unknown;
      availableCardIds: ReadonlySet<string>;
      enforceUniqueOrder: boolean;
    }) => {
      cardsOrder: string[];
      currentIndex: number;
      repaired: boolean;
    } | null;

    const sanitizePersistedStudyOrder = (
      studySessionSnapshotModule as unknown as { sanitizePersistedStudyOrder?: Sanitizer }
    ).sanitizePersistedStudyOrder;

    expect(sanitizePersistedStudyOrder).toBeTypeOf("function");

    const restored = sanitizePersistedStudyOrder?.({
      sessionOrder: ["red-1", "normal-1", "red-1"],
      currentIndex: 2,
      availableCardIds: new Set(["red-1", "normal-1"]),
      enforceUniqueOrder: false,
    });

    expect(restored).toEqual({
      cardsOrder: ["red-1", "normal-1", "red-1"],
      currentIndex: 2,
      repaired: false,
    });
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

  it("appends a newly available card without discarding the existing queue", () => {
    const snapshot = sanitizeStudySnapshot({
      version: 2,
      sessionId: "session-1",
      currentIndex: 1,
      cardsOrder: ["card-1", "card-2"],
      results: [],
      timestamp: 123,
    }, new Set(["card-1", "card-2", "card-3"]));

    expect(snapshot?.cardsOrder).toEqual(["card-1", "card-2", "card-3"]);
    expect(snapshot?.currentIndex).toBe(1);
  });

  it("preserves a valid layered-card position and drops an invalid one", () => {
    const restored = sanitizeStudySnapshot({
      version: 2,
      sessionId: "layered-session",
      currentIndex: 0,
      cardsOrder: ["entry-card"],
      results: [],
      timestamp: 123,
      layer: { cardId: "entry-card", layerIdx: 2 },
    }, new Set(["entry-card"]));

    expect(restored?.layer).toEqual({ cardId: "entry-card", layerIdx: 2 });
    expect(sanitizeStudySnapshot({
      version: 2,
      sessionId: "layered-session",
      currentIndex: 0,
      cardsOrder: ["entry-card"],
      results: [],
      timestamp: 123,
      layer: { cardId: "entry-card", layerIdx: -1 },
    }, new Set(["entry-card"]))?.layer).toBeUndefined();
  });

  it("keeps results for playable layers that are nested outside the queue ids", () => {
    const restored = sanitizeStudySnapshot({
      version: 2,
      sessionId: "layered-session",
      currentIndex: 0,
      cardsOrder: ["parent-card"],
      results: [{ flashcardId: "layer-2", correct: false, skipped: false, attempts: 1 }],
      timestamp: 123,
    }, new Set(["parent-card"]), { resultCardIds: new Set(["parent-card", "layer-2"]) });

    expect(restored?.results).toEqual([
      { flashcardId: "layer-2", correct: false, skipped: false, attempts: 1 },
    ]);
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
