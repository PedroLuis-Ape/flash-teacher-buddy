import { describe, expect, it } from "vitest";
import {
  filterCardsForStudyScope,
  isStudyScopeDataUsable,
  resolveStudyScopeDataStatus,
} from "./studyScopePolicy";
import { buildStudySettingsRoute } from "./studyCompletionNavigation";

const settled = { isSuccess: true, isError: false, fetchStatus: "idle" as const, isPlaceholderData: false };

describe("Rewrite mode scope harmony", () => {
  const principal = { id: "p1", status_group_uid: "g1" } as never;
  const layer = { id: "l1", parent_card_id: "p1", status_group_uid: "g1" } as never;
  const other = { id: "p2", status_group_uid: "g2" } as never;

  it("keeps every card when scope is all", () => {
    const result = filterCardsForStudyScope({
      cards: [principal, other],
      favoriteIds: [],
      redListIds: [],
      settings: { subset: "all" },
    });
    expect(result).toHaveLength(2);
  });

  it("filters by canonical group identity for layered cards", () => {
    const result = filterCardsForStudyScope({
      cards: [principal, other],
      favoriteIds: ["g1"],
      redListIds: [],
      settings: { subset: "favorites" },
    });
    expect(result).toEqual([principal]);
  });

  it("matches a legacy favorite stored on the layer id", () => {
    const result = filterCardsForStudyScope({
      cards: [layer, other],
      favoriteIds: ["l1"],
      redListIds: [],
      settings: { subset: "favorites" },
    });
    expect(result).toEqual([layer]);
  });

  it("returns an empty deck only when the favorites set truly excludes the cards", () => {
    const result = filterCardsForStudyScope({
      cards: [principal, other],
      favoriteIds: ["missing"],
      redListIds: [],
      settings: { subset: "favorites" },
    });
    expect(result).toEqual([]);
  });
});

describe("resolveStudyScopeDataStatus", () => {
  it("is not required when the session studies all cards", () => {
    const status = resolveStudyScopeDataStatus({ required: false, userId: "u1", query: settled });
    expect(status).toBe("not-required");
    expect(isStudyScopeDataUsable(status)).toBe(true);
  });

  it("is not required without an authenticated user", () => {
    expect(resolveStudyScopeDataStatus({ required: true, userId: null, query: settled })).toBe("not-required");
  });

  it("is loading while fetching", () => {
    const status = resolveStudyScopeDataStatus({
      required: true,
      userId: "u1",
      query: { ...settled, isSuccess: false, fetchStatus: "fetching" },
    });
    expect(status).toBe("loading");
    expect(isStudyScopeDataUsable(status)).toBe(false);
  });

  it("is loading while showing placeholder data", () => {
    expect(resolveStudyScopeDataStatus({
      required: true,
      userId: "u1",
      query: { ...settled, isPlaceholderData: true },
    })).toBe("loading");
  });

  it("is error when the settled query failed", () => {
    const status = resolveStudyScopeDataStatus({
      required: true,
      userId: "u1",
      query: { isSuccess: false, isError: true, fetchStatus: "idle", isPlaceholderData: false },
    });
    expect(status).toBe("error");
    expect(isStudyScopeDataUsable(status)).toBe(false);
  });

  it("is ready when settled and successful", () => {
    expect(resolveStudyScopeDataStatus({ required: true, userId: "u1", query: settled })).toBe("ready");
  });
});

describe("buildStudySettingsRoute", () => {
  it("returns the list games hub keeping the mode", () => {
    expect(buildStudySettingsRoute({
      pathname: "/list/abc/study",
      resolvedId: "abc",
      isListRoute: true,
      searchParams: new URLSearchParams("mode=write&dir=b-a&from_goal=1"),
    })).toBe("/list/abc/games?mode=write");
  });

  it("supports portal collections", () => {
    expect(buildStudySettingsRoute({
      pathname: "/portal/collection/xyz/study",
      resolvedId: "xyz",
      isListRoute: false,
      searchParams: new URLSearchParams(""),
    })).toBe("/portal/collection/xyz/games");
  });
});
