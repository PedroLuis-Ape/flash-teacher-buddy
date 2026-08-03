import { describe, expect, it } from "vitest";
import { buildStudyLaunchSearchParams } from "./studyLaunchParams";

describe("buildStudyLaunchSearchParams", () => {
  it("launches the selected mode without overriding its saved preset", () => {
    const params = buildStudyLaunchSearchParams("write");

    expect(params.get("mode")).toBe("write");
    expect(params.has("dir")).toBe(false);
    expect(params.has("direction")).toBe(false);
    expect(params.has("order")).toBe(false);
    expect(params.has("favorites")).toBe(false);
    expect(params.has("fastMode")).toBe(false);
    expect(params.has("fast")).toBe(false);
  });

  it("normalizes aliases and preserves the optional class context", () => {
    const params = buildStudyLaunchSearchParams("multiple", "turma-123");

    expect(params.get("mode")).toBe("multiple-choice");
    expect(params.get("turma")).toBe("turma-123");
  });

  it("carries the explicit deck scope chosen in the hub", () => {
    const favorites = buildStudyLaunchSearchParams("multiple", null, { scope: "favorites" });
    expect(favorites.get("mode")).toBe("multiple-choice");
    expect(favorites.get("favorites")).toBe("true");

    const all = buildStudyLaunchSearchParams("pronunciation", null, { scope: "all" });
    expect(all.get("favorites")).toBe("false");
  });

  it("carries the flow format only when explicitly requested", () => {
    expect(buildStudyLaunchSearchParams("write", null, { scope: "all" }).has("flow")).toBe(false);
    expect(
      buildStudyLaunchSearchParams("write", null, { scope: "all", studyFlowMode: "mastery_rounds" })
        .get("flow"),
    ).toBe("mastery_rounds");
  });
});
