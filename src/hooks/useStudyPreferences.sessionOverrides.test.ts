import { describe, expect, it } from "vitest";
import { parseStudySessionOverrides } from "./useStudyPreferences";

describe("study session URL overrides", () => {
  it("parses supported temporary values", () => {
    expect(parseStudySessionOverrides(new URLSearchParams({
      mode: "multiple",
      dir: "b-a",
      order: "sequential",
      favorites: "true",
      fast: "true",
    }))).toEqual({
      mode: "multiple-choice",
      direction: "b-a",
      order: "sequential",
      scope: "favorites",
      fastMode: true,
    });
  });

  it("ignores invalid temporary values", () => {
    expect(parseStudySessionOverrides(new URLSearchParams({
      dir: "invalid",
      order: "invalid",
      favorites: "sometimes",
    }))).toEqual({});
  });
});
