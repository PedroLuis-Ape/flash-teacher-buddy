import { describe, expect, it } from "vitest";
import {
  buildLegacyStudySessionScopeKey,
  buildStudySessionScopeKey,
  buildStudySessionSettingsSnapshot,
  isStudySessionSettingsSnapshot,
  studySessionSettingsToPresetOverride,
} from "./studySessionContext";

describe("study session context", () => {
  it("keeps one identity when settings change during the same mode session", () => {
    const base = { mode: "write" as const, subset: "all" as const, order: "random" as const };
    expect(buildStudySessionScopeKey(base)).toBe(
      buildStudySessionScopeKey({ ...base, direction: "b-a" }),
    );
    expect(buildStudySessionScopeKey(base)).toBe(
      buildStudySessionScopeKey({ ...base, studyFlowMode: "mastery_rounds" }),
    );
    expect(buildStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey({ ...base, mode: "flip" }),
    );
  });

  it("retains the previous settings-based key only as a compatibility key", () => {
    const base = { mode: "write" as const, subset: "all" as const, order: "random" as const };
    expect(buildLegacyStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey(base),
    );
    expect(buildLegacyStudySessionScopeKey(base)).not.toBe(
      buildLegacyStudySessionScopeKey({ ...base, direction: "b-a" }),
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

  it("maps a valid session snapshot to ephemeral preference overrides", () => {
    const snapshot = buildStudySessionSettingsSnapshot({
      mode: "write",
      subset: "favorites",
      order: "sequential",
      direction: "b-a",
      fastMode: true,
      studyFlowMode: "continuous",
      writeActivityMode: "rewrite",
      writeRewriteSide: "alternating",
      writeCorrectionMode: "hard",
    });

    expect(studySessionSettingsToPresetOverride(snapshot)).toEqual({
      direction: "b-a",
      order: "sequential",
      scope: "favorites",
      fastMode: true,
      studyFlowMode: "continuous",
      writeActivityMode: "rewrite",
      writeRewriteSide: "alternating",
      writeCorrectionMode: "hard",
    });
    expect(studySessionSettingsToPresetOverride({ version: 2 })).toBeNull();
  });
});
