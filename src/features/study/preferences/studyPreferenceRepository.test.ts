import { describe, expect, it } from "vitest";
import { DEFAULT_STUDY_PRESET } from "./studyPreset";
import {
  isMissingStudyPreferenceSchemaError,
  mapGlobalPreferenceRow,
  mapListPreferenceRow,
  toGlobalPreferenceRow,
  toListPreferenceRow,
} from "./studyPreferenceRepository";

describe("studyPreferenceRepository", () => {
  it("maps database fields into a global preset", () => {
    expect(mapGlobalPreferenceRow({
      mode: "mixed",
      direction: "a-b",
      card_order: "sequential",
      scope: "all",
      fast_mode: true,
      play_mode: "single",
      play_side: "b",
    })).toEqual({
      mode: "mixed",
      direction: "a-b",
      order: "sequential",
      scope: "all",
      fastMode: true,
      playMode: "single",
      playSide: "b",
    });
  });

  it("maps nullable list fields into a minimal override", () => {
    expect(mapListPreferenceRow({
      mode: "write",
      direction: null,
      card_order: null,
      scope: "favorites",
      fast_mode: null,
      play_mode: "single",
      play_side: "a",
    })).toEqual({
      mode: "write",
      scope: "favorites",
      playMode: "single",
      playSide: "a",
    });
  });

  it("serializes global and list values", () => {
    expect(toGlobalPreferenceRow("user-1", DEFAULT_STUDY_PRESET)).toMatchObject({
      user_id: "user-1",
      card_order: "random",
      fast_mode: false,
      play_mode: "both",
      play_side: "a",
    });
    expect(toListPreferenceRow("user-1", "list-1", {
      mode: "write",
      playMode: "single",
      playSide: "b",
    })).toMatchObject({
      user_id: "user-1",
      list_id: "list-1",
      mode: "write",
      direction: null,
      play_mode: "single",
      play_side: "b",
    });
  });

  it("classifies missing schema errors for local fallback", () => {
    expect(isMissingStudyPreferenceSchemaError({ code: "42P01" })).toBe(true);
    expect(isMissingStudyPreferenceSchemaError({ code: "PGRST205" })).toBe(true);
    expect(isMissingStudyPreferenceSchemaError({ code: "42501" })).toBe(false);
  });
});