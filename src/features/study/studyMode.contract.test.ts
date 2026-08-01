import { describe, expect, it } from "vitest";
import { normalizeStudyMode } from "./lib/studyMode";
import {
  DEFAULT_STUDY_PRESET,
  STUDY_PRESET_MODES,
  normalizeStudyPreset,
} from "./preferences/studyPreset";

describe("canonical study-mode contract", () => {
  it("keeps the six engine modes explicit and independently normalizable", () => {
    expect([...STUDY_PRESET_MODES]).toEqual([
      "flip",
      "write",
      "multiple-choice",
      "unscramble",
      "mixed",
      "pronunciation",
    ]);

    for (const mode of STUDY_PRESET_MODES) {
      expect(normalizeStudyMode(mode)).toBe(mode);
      expect(normalizeStudyPreset({ mode }).mode).toBe(mode);
    }
  });

  it("keeps rewrite as a validated write submode, not a seventh session key", () => {
    const preset = normalizeStudyPreset({
      mode: "write",
      writeActivityMode: "rewrite",
      writeRewriteSide: "b",
    });

    expect(preset.mode).toBe("write");
    expect(preset.writeActivityMode).toBe("rewrite");
    expect(preset.writeRewriteSide).toBe("b");
    expect(DEFAULT_STUDY_PRESET.writeActivityMode).toBe("translate");
  });

  it("does not let an unknown external mode create a new persistence scope", () => {
    expect(normalizeStudyMode("rewrite")).toBe("flip");
    expect(normalizeStudyMode("not-a-mode")).toBe("flip");
    expect(normalizeStudyMode("multiple")).toBe("multiple-choice");
  });
});
