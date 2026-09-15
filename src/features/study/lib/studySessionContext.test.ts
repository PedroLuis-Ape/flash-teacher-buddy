import { describe, expect, it } from "vitest";
import {
  buildLegacyStudySessionScopeKey,
  buildLegacyStudySessionScopeKeyCandidates,
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
      playTarget: "both",
      fastMode: true,
      studyFlowMode: "continuous",
      writeActivityMode: "rewrite",
      writeRewriteSide: "alternating",
      writeCorrectionMode: "hard",
    });
    expect(studySessionSettingsToPresetOverride({ version: 2 })).toBeNull();
  });
});

describe("legacy v1 scope key compatibility", () => {
  const legacyKeyFor = (input: {
    mode: string;
    subset: "all" | "favorites";
    order: "random" | "sequential";
    redFocus: boolean;
    fastMode: boolean;
    direction: "a-b" | "b-a" | "any";
    studyFlowMode: "continuous" | "mastery_rounds";
    playMode?: "both" | "single";
    playSide?: "a" | "b";
  }) => {
    const snapshot: Record<string, unknown> = {
      version: 1,
      mode: input.mode,
      subset: input.subset,
      order: input.order,
      redFocus: input.redFocus,
      fastMode: input.fastMode,
      direction: input.direction,
      studyFlowMode: input.studyFlowMode,
    };
    if (input.playMode) snapshot.playMode = input.playMode;
    if (input.playSide) snapshot.playSide = input.playSide;
    return `study-session-v1:${encodeURIComponent(JSON.stringify(snapshot))}`;
  };

  const directions = ["a-b", "b-a", "any"] as const;
  const plays = [
    { playMode: "both", playSide: "a" },
    { playMode: "both", playSide: "b" },
    { playMode: "single", playSide: "a" },
    { playMode: "single", playSide: "b" },
    {},
  ] as const;

  it("covers every historical playMode/playSide pair for each direction", () => {
    for (const direction of directions) {
      const context = {
        mode: "flip" as const,
        subset: "all" as const,
        order: "random" as const,
        redFocus: false,
        fastMode: false,
        direction,
        studyFlowMode: "continuous" as const,
      };
      const candidates = buildLegacyStudySessionScopeKeyCandidates(context);
      for (const play of plays) {
        expect(candidates).toContain(legacyKeyFor({ ...context, ...play }));
      }
      // A chave semântica atual continua sendo a primeira tentativa.
      expect(candidates[0]).toBe(buildLegacyStudySessionScopeKey(context));
      expect(new Set(candidates).size).toBe(candidates.length);
    }
  });

  it("never mixes different decks or flows into the same candidate set", () => {
    const base = {
      mode: "write" as const,
      subset: "all" as const,
      order: "random" as const,
      redFocus: false,
      fastMode: false,
      direction: "a-b" as const,
      studyFlowMode: "continuous" as const,
    };
    const candidates = buildLegacyStudySessionScopeKeyCandidates(base);
    const favorites = buildLegacyStudySessionScopeKeyCandidates({ ...base, subset: "favorites" });
    const mastery = buildLegacyStudySessionScopeKeyCandidates({ ...base, studyFlowMode: "mastery_rounds" });
    expect(candidates.some((key) => favorites.includes(key))).toBe(false);
    expect(candidates.some((key) => mastery.includes(key))).toBe(false);
  });
});
