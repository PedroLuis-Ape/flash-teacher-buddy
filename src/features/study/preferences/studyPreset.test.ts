import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDY_PRESET,
  diffStudyPreset,
  isEmptyStudyPresetOverride,
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
  resolveStudyPreset,
} from "./studyPreset";

describe("studyPreset", () => {
  it("normalizes invalid values to safe defaults", () => {
    expect(normalizeStudyPreset({
      mode: "bad",
      direction: "bad",
      playMode: "bad",
      playSide: "bad",
    })).toEqual(DEFAULT_STUDY_PRESET);
  });

  it("normalizes valid partial list overrides without filling defaults", () => {
    expect(normalizeStudyPresetOverride({
      mode: "write",
      fastMode: false,
      direction: "bad",
      playMode: "single",
      playSide: "b",
    })).toEqual({
      mode: "write",
      fastMode: false,
      playMode: "single",
      playSide: "b",
    });
  });

  it("resolves defaults then global then list then session", () => {
    expect(resolveStudyPreset({
      globalPreset: {
        ...DEFAULT_STUDY_PRESET,
        mode: "mixed",
        direction: "a-b",
        playMode: "both",
        playSide: "a",
      },
      listOverride: { mode: "write", playMode: "single", playSide: "b" },
      sessionOverrides: { direction: "b-a" },
    })).toEqual({
      ...DEFAULT_STUDY_PRESET,
      mode: "write",
      direction: "b-a",
      playMode: "single",
      playSide: "b",
    });
  });

  it("computes only fields different from global", () => {
    expect(diffStudyPreset(
      { ...DEFAULT_STUDY_PRESET, mode: "write", fastMode: true, playMode: "single" },
      { ...DEFAULT_STUDY_PRESET, mode: "mixed", fastMode: true },
    )).toEqual({ mode: "write", playMode: "single" });
  });

  it("preserves the current autoplay behavior by default", () => {
    expect(DEFAULT_STUDY_PRESET.playMode).toBe("both");
    expect(DEFAULT_STUDY_PRESET.playSide).toBe("a");
  });

  it("recognizes empty overrides", () => {
    expect(isEmptyStudyPresetOverride({})).toBe(true);
    expect(isEmptyStudyPresetOverride({ mode: "flip" })).toBe(false);
  });

  it("does not model red focus as a persisted field", () => {
    expect("redFocus" in DEFAULT_STUDY_PRESET).toBe(false);
  });
});