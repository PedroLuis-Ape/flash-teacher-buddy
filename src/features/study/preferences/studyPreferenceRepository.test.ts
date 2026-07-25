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
  it("uses game_mode as the global preset identity", () => {
    expect(mapGlobalPreferenceRow({
      game_mode: "mixed",
      mode: "flip",
      direction: "a-b",
      card_order: "sequential",
      scope: "all",
      fast_mode: true,
      play_mode: "single",
      play_side: "b",
    }, "mixed")).toEqual({
      mode: "mixed",
      direction: "a-b",
      order: "sequential",
      scope: "all",
      fastMode: true,
      playMode: "single",
      playSide: "b",
      studyFlowMode: "mastery_rounds",
    });
  });

  it("maps nullable list fields without leaking the game identity into the override", () => {
    expect(mapListPreferenceRow({
      game_mode: "write",
      mode: "write",
      direction: null,
      card_order: null,
      scope: "favorites",
      fast_mode: null,
      play_mode: "single",
      play_side: "a",
    }, "write")).toEqual({
      scope: "favorites",
      playMode: "single",
      playSide: "a",
    });
  });

  it("serializes global and list values with a separate game_mode key", () => {
    expect(toGlobalPreferenceRow("user-1", DEFAULT_STUDY_PRESET, "flip")).toMatchObject({
      user_id: "user-1",
      game_mode: "flip",
      mode: "flip",
      card_order: "random",
      fast_mode: false,
      play_mode: "both",
      play_side: "a",
    });
    expect(toListPreferenceRow("user-1", "list-1", {
      playMode: "single",
      playSide: "b",
    }, "write")).toMatchObject({
      user_id: "user-1",
      list_id: "list-1",
      game_mode: "write",
      mode: null,
      direction: null,
      play_mode: "single",
      play_side: "b",
    });
  });

  it("classifies missing schema errors for local fallback", () => {
    expect(isMissingStudyPreferenceSchemaError({ code: "42P01" })).toBe(true);
    expect(isMissingStudyPreferenceSchemaError({ code: "PGRST205" })).toBe(true);
    expect(isMissingStudyPreferenceSchemaError({ code: "42703", message: "game_mode column" })).toBe(true);
    expect(isMissingStudyPreferenceSchemaError({ code: "42501" })).toBe(false);
  });
});
