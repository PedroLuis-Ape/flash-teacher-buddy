import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildStudyLaunchSearchParams } from "@/features/study/lib/studyLaunchParams";
import { parseStudySessionOverrides } from "@/hooks/useStudyPreferences";

const hub = readFileSync("src/pages/GamesHub.tsx", "utf8");

describe("GamesHub launch intent", () => {
  it("captures the visible deck scope and sends it on every tile click", () => {
    expect(hub).toContain("const launchScope = visibleScope;");
    expect(hub).toContain("{ scope: launchScope }");
  });

  it("blocks the click only while favorites are loading/mutating", () => {
    expect(hub).toContain("if (favoritesBusy) {");
    expect(hub).toContain('disabled={favoritesBusy}');
    expect(hub).not.toContain("favoritesBusy || favoritesCount === 0");
  });

  it("favorites visible on write then clicking multiple choice opens favorites", () => {
    const params = buildStudyLaunchSearchParams("multiple", null, { scope: "favorites" });
    expect(params.get("mode")).toBe("multiple-choice");
    expect(parseStudySessionOverrides(params).scope).toBe("favorites");
  });

  it("all visible on flip then clicking pronunciation opens all", () => {
    const params = buildStudyLaunchSearchParams("pronunciation", null, { scope: "all" });
    expect(parseStudySessionOverrides(params).scope).toBe("all");
  });

  it("launch intent wins over the previous preset of the clicked mode", () => {
    const overrides = parseStudySessionOverrides(
      buildStudyLaunchSearchParams("write", null, { scope: "favorites", studyFlowMode: "continuous" }),
    );
    expect(overrides.scope).toBe("favorites");
    expect(overrides.studyFlowMode).toBe("continuous");
  });
});

describe("Study consumes launch intent", () => {
  const study = readFileSync("src/pages/Study.tsx", "utf8");
  it("reads favorites=true|false and persists it after hydration", () => {
    expect(study).toContain('searchParams.get("favorites")');
    expect(study).toContain("updateForCurrentScope({ scope: launchScopeIntent })");
  });
});
