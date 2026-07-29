import { describe, expect, it } from "vitest";
import {
  buildStudyLaunchSearchParams,
  resolveStudyLaunchRoute,
} from "./studyLaunchParams";

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
    const params = buildStudyLaunchSearchParams("multiple", "turma-123", "continuous");

    expect(params.get("mode")).toBe("multiple-choice");
    expect(params.get("turma")).toBe("turma-123");
    expect(params.get("flow")).toBe("continuous");
  });

  it("uses the adaptive mixed route only for gamified mixed sessions", () => {
    expect(resolveStudyLaunchRoute("mixed", "mastery_rounds")).toBe("mixed-study");
    expect(resolveStudyLaunchRoute("mixed", "continuous")).toBe("study");
    expect(resolveStudyLaunchRoute("flip", "mastery_rounds")).toBe("study");
    expect(resolveStudyLaunchRoute("write", "continuous")).toBe("study");
  });
});
