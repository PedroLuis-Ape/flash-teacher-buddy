import { describe, expect, it } from "vitest";
import {
  derivePrivateListId,
  parseStudySessionOverrides,
  selectChangedLegacyPreferences,
  shouldPersistStudyPreferences,
  stripTransientRedFocusOrder,
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

  it("does not persist any setting forced through a red focus transition", () => {
    expect(stripTransientRedFocusOrder({
      order: "sequential",
      favoritesOnly: true,
      fastMode: false,
    }, true)).toEqual({});
    expect(stripTransientRedFocusOrder({ order: "random" }, false)).toEqual({ order: "random" });
  });

  it("persists only fields that actually changed in a legacy snapshot", () => {
    expect(selectChangedLegacyPreferences({
      order: "sequential",
      favoritesOnly: true,
      fastMode: false,
    }, {
      mode: "flip",
      direction: "a-b",
      order: "random",
      favoritesOnly: true,
      fastMode: false,
    })).toEqual({ order: "sequential" });
  });
});
