import { describe, expect, it } from "vitest";
import {
  derivePrivateListId,
  parseStudySessionOverrides,
  shouldPersistStudyPreferences,
} from "./useStudyPreferences";

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

  it("derives only private list routes", () => {
    expect(derivePrivateListId("/list/list-1/study")).toBe("list-1");
    expect(derivePrivateListId("/portal/list/list-1/study")).toBeUndefined();
    expect(derivePrivateListId("/collection/collection-1/study")).toBeUndefined();
  });

  it("keeps portal changes temporary unless explicitly enabled", () => {
    expect(shouldPersistStudyPreferences("/portal/list/list-1/study")).toBe(false);
    expect(shouldPersistStudyPreferences("/list/list-1/study")).toBe(true);
    expect(shouldPersistStudyPreferences("/portal/list/list-1/study", true)).toBe(true);
    expect(shouldPersistStudyPreferences("/list/list-1/study", false)).toBe(false);
  });
});
