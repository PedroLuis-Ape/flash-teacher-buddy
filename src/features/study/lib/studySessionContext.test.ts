import { describe, expect, it } from "vitest";
import {
  buildStudySessionScopeKey,
  buildStudySessionSettingsSnapshot,
  isStudySessionSettingsSnapshot,
} from "./studySessionContext";

describe("study session context", () => {
  it("changes identity when a queue-affecting setting changes", () => {
    const base = { mode: "write" as const, subset: "all" as const, order: "random" as const };
    expect(buildStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey({ ...base, direction: "b-a" }),
    );
    expect(buildStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey({ ...base, studyFlowMode: "mastery_rounds" }),
    );
  });

  it("is deterministic and validates the stored snapshot contract", () => {
    const snapshot = buildStudySessionSettingsSnapshot({
      mode: "mixed",
      subset: "favorites",
      order: "sequential",
      direction: "a-b",
      studyFlowMode: "mastery_rounds",
      writeActivityMode: "rewrite",
    });
    expect(snapshot).toMatchObject({ version: 1, mode: "mixed", writeActivityMode: "rewrite" });
    expect(isStudySessionSettingsSnapshot(snapshot)).toBe(true);
    expect(isStudySessionSettingsSnapshot({ ...snapshot, version: 2 })).toBe(false);
  });
});
