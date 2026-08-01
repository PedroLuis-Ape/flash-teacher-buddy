import { describe, expect, it } from "vitest";
import {
  isStudyDeckLoading,
  studyDeckRecoveryReason,
  studyDeckTechnicalId,
  type StudyDeckLoadState,
} from "./studyDeckLoadState";

describe("studyDeckLoadState", () => {
  it.each(["waiting-auth", "loading", "retrying"] as const)("marks %s as loading", (phase) => {
    const state = phase === "waiting-auth"
      ? { phase, reason: "auth" as const }
      : { phase, attempt: 1 };
    expect(isStudyDeckLoading(state)).toBe(true);
  });

  it.each(["idle", "ready", "empty-unconfirmed", "confirmed-empty", "recoverable-error", "cancelled"] as const)(
    "does not mark %s as loading",
    (phase) => {
      const states: Record<typeof phase, StudyDeckLoadState> = {
        idle: { phase: "idle" },
        ready: { phase: "ready", requestId: "r", source: "private-rest", rawCount: 1, playableCount: 1 },
        "empty-unconfirmed": { phase: "empty-unconfirmed", reason: "unknown" },
        "confirmed-empty": { phase: "confirmed-empty", requestId: "r", source: "private-rest" },
        "recoverable-error": { phase: "recoverable-error", reason: "network" },
        cancelled: { phase: "cancelled" },
      };
      expect(isStudyDeckLoading(states[phase])).toBe(false);
    },
  );

  it("exposes only safe diagnostic reasons", () => {
    const state: StudyDeckLoadState = { phase: "empty-unconfirmed", reason: "auth-or-access" };
    expect(studyDeckRecoveryReason(state)).toBe("auth-or-access");
    expect(studyDeckTechnicalId("ST", state)).toBe("ST-auth-or-access");
  });
});
