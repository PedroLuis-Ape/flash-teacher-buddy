import { describe, expect, it, vi } from "vitest";
import {
  resolveStudyAnswerIdentity,
  resolveStudySessionReadiness,
  StudyRuntimeTimeoutError,
  withStudyRuntimeTimeout,
} from "./studySessionRuntime";

const readyInput = {
  pageLoading: false,
  engineLoading: false,
  eligibleCardIds: ["card-1", "card-2"],
  cardsOrder: ["card-1", "card-2"],
  currentIndex: 0,
  isFinished: false,
  masteryStatus: null,
} as const;

describe("resolveStudySessionReadiness", () => {
  it("reports a playable session only when the current id exists", () => {
    expect(resolveStudySessionReadiness(readyInput)).toMatchObject({
      phase: "ready",
      currentCardId: "card-1",
    });
  });

  it("prioritizes a legitimate completion over a missing current card", () => {
    expect(resolveStudySessionReadiness({
      ...readyInput,
      currentIndex: 2,
      isFinished: true,
    })).toMatchObject({
      phase: "completed",
      reason: "legitimately-completed",
    });
  });

  it.each([
    { cardsOrder: [], currentIndex: 0, reason: "empty-order" },
    { cardsOrder: ["card-1"], currentIndex: 7, reason: "index-out-of-range" },
    { cardsOrder: ["removed-card"], currentIndex: 0, reason: "current-card-missing" },
  ])("never treats an inconsistent queue as ready: $reason", (state) => {
    expect(resolveStudySessionReadiness({
      ...readyInput,
      ...state,
    })).toMatchObject({
      phase: "recovering",
      reason: state.reason,
    });
  });

  it("leaves recovery instead of preparing forever after repair fails", () => {
    expect(resolveStudySessionReadiness({
      ...readyInput,
      cardsOrder: [],
      recoveryFailed: true,
    }).phase).toBe("failed");
  });

  it("never remains in Preparing your session when eligible cards exist", () => {
    const firstPass = resolveStudySessionReadiness({
      ...readyInput,
      cardsOrder: [],
    });
    const afterRecovery = resolveStudySessionReadiness({
      ...readyInput,
      cardsOrder: [],
      recoveryFailed: true,
    });

    expect(firstPass.phase).toBe("recovering");
    expect(afterRecovery.phase).toBe("failed");
  });

  it("recognizes round and journey summaries as completed states", () => {
    for (const masteryStatus of ["round-complete", "journey-complete"] as const) {
      expect(resolveStudySessionReadiness({
        ...readyInput,
        cardsOrder: [],
        masteryStatus,
      }).phase).toBe("completed");
    }
  });

  it("exposes cancellation separately from loading and failure", () => {
    expect(resolveStudySessionReadiness({
      ...readyInput,
      cancelled: true,
    })).toMatchObject({
      phase: "cancelled",
      reason: "request-cancelled",
    });
  });

  it("distinguishes a bounded retry from the first load", () => {
    expect(resolveStudySessionReadiness({
      ...readyInput,
      pageLoading: true,
      retrying: true,
    })).toMatchObject({
      phase: "retrying",
      reason: "required-data-loading",
    });

    expect(resolveStudySessionReadiness({
      ...readyInput,
      pageLoading: true,
    }).phase).toBe("loading");
  });
});

describe("resolveStudyAnswerIdentity", () => {
  it("keeps visible-layer progress separate from the engine advance identity", () => {
    expect(resolveStudyAnswerIdentity("layer-3", "layer-1")).toEqual({
      progressCardId: "layer-3",
      engineCardId: "layer-1",
    });
  });

  it("uses the same identity for a regular card", () => {
    expect(resolveStudyAnswerIdentity("card-1", "card-1")).toEqual({
      progressCardId: "card-1",
      engineCardId: "card-1",
    });
  });
});

describe("withStudyRuntimeTimeout", () => {
  it("rejects a stalled dependency with a controlled timeout", async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => undefined);
    const onTimeout = vi.fn();
    const result = withStudyRuntimeTimeout(
      pending,
      100,
      "remote-session",
      onTimeout,
    );
    const rejection = expect(result).rejects.toBeInstanceOf(StudyRuntimeTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(onTimeout).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
