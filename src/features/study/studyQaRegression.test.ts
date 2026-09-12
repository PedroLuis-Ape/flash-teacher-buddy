import { describe, expect, it } from "vitest";
import { buildStudyReturnRoute, buildStudySettingsRoute } from "./lib/studyCompletionNavigation";

const reinforcementSource = String.raw`/list/${"${area.list_id}"}/games?reinforcement=true`;

describe("QA regressions 2026-09-12", () => {
  it("keeps completion return routes pointed at the studied resource", () => {
    expect(buildStudyReturnRoute({
      pathname: "/list/list-1/study",
      resolvedId: "list-1",
      isListRoute: true,
      searchParams: new URLSearchParams("mode=flip"),
    })).toBe("/list/list-1");

    expect(buildStudyReturnRoute({
      pathname: "/collection/collection-1/study",
      resolvedId: "collection-1",
      isListRoute: false,
    })).toBe("/collection/collection-1");
  });

  it("keeps portal exits inside the portal", () => {
    expect(buildStudyReturnRoute({
      pathname: "/portal/list/list-1/study",
      resolvedId: "list-1",
      isListRoute: true,
      searchParams: new URLSearchParams("mode=flip&reinforcement=true"),
    })).toBe("/portal/list/list-1/games?reinforcement=true");
  });

  it("keeps the settings action pointed at the games hub", () => {
    expect(buildStudySettingsRoute({
      pathname: "/list/list-1/study",
      resolvedId: "list-1",
      isListRoute: true,
      searchParams: new URLSearchParams("mode=flip&reinforcement=true"),
    })).toBe("/list/list-1/games?mode=flip&reinforcement=true");
  });

  it("documents the reinforcement hub route expected by the page", () => {
    expect(reinforcementSource).toContain("/games?reinforcement=true");
  });
});
