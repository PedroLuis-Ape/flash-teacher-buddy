import { describe, expect, it } from "vitest";
import {
  buildLegacyStudySessionScopeKey,
  buildStudySessionScopeKey,
  buildStudySessionSettingsSnapshot,
  isPersistedStudySessionCompatible,
  isStudySessionSettingsSnapshot,
  studySessionSettingsToPresetOverride,
} from "./studySessionContext";

describe("study session context", () => {
  it("keeps one identity for non-deck settings but isolates deck scope and flow", () => {
    const base = { mode: "write" as const, subset: "all" as const, order: "random" as const };
    expect(buildStudySessionScopeKey(base)).toBe(
      buildStudySessionScopeKey({ ...base, direction: "b-a" }),
    );
    expect(buildStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey({ ...base, studyFlowMode: "mastery_rounds" }),
    );
    expect(buildStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey({ ...base, mode: "flip" }),
    );
    expect(buildStudySessionScopeKey(base)).not.toBe(
      buildStudySessionScopeKey({ ...base, subset: "favorites" }),
    );
    expect(buildStudySessionScopeKey({ ...base, redFocus: true })).toBe(
      "study-session-v3:write:red-focus:continuous",
    );
    expect(buildStudySessionScopeKey(base)).toBe("study-session-v3:write:all:continuous");
  });

  it("only accepts a v3 session when the key is exactly the same", () => {
    const expected = { mode: "write" as const, subset: "favorites" as const };
    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: buildStudySessionScopeKey(expected),
    })).toBe(true);
    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: buildStudySessionScopeKey({ ...expected, subset: "all" }),
    })).toBe(false);
    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: buildStudySessionScopeKey({ ...expected, studyFlowMode: "mastery_rounds" }),
    })).toBe(false);
  });

  it("accepts a legacy session only with an exactly compatible settings snapshot", () => {
    const expected = { mode: "write" as const, subset: "favorites" as const };
    const legacyKey = buildLegacyStudySessionScopeKey(expected);

    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: legacyKey,
      settingsSnapshot: buildStudySessionSettingsSnapshot(expected),
    })).toBe(true);
    // Sessão de "Todos" nunca controla Favoritos, e vice-versa.
    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: legacyKey,
      settingsSnapshot: buildStudySessionSettingsSnapshot({ ...expected, subset: "all" }),
    })).toBe(false);
    expect(isPersistedStudySessionCompatible({
      expected: { ...expected, subset: "all" },
      sessionScopeKey: legacyKey,
      settingsSnapshot: buildStudySessionSettingsSnapshot(expected),
    })).toBe(false);
    // Gamificado nunca controla Extenso.
    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: legacyKey,
      settingsSnapshot: buildStudySessionSettingsSnapshot({
        ...expected,
        studyFlowMode: "mastery_rounds",
      }),
    })).toBe(false);
    // Sem snapshot comprovável, não restaura.
    expect(isPersistedStudySessionCompatible({
      expected,
      sessionScopeKey: legacyKey,
    })).toBe(false);
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
