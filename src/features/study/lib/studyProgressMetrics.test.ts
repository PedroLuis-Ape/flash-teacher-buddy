import { describe, expect, it } from "vitest";
import { resolveStudyProgressMetrics } from "./studyProgressMetrics";

describe("resolveStudyProgressMetrics", () => {
  it("separates overall mastery progress from the current round", () => {
    const metrics = resolveStudyProgressMetrics({
      mode: "mastery",
      overallTotal: 80,
      masteredTotal: 32,
      currentIndex: 10,
      currentRoundTotal: 15,
    });

    expect(metrics).toEqual({
      overallCompleted: 32,
      overallRemaining: 48,
      overallPercent: 40,
      roundPosition: 11,
      roundPercent: (11 / 15) * 100,
    });
  });

  it("uses the current deck position for continuous sessions", () => {
    const metrics = resolveStudyProgressMetrics({
      mode: "continuous",
      overallTotal: 20,
      currentIndex: 4,
      currentRoundTotal: 20,
    });

    expect(metrics.overallCompleted).toBe(5);
    expect(metrics.overallRemaining).toBe(15);
    expect(metrics.overallPercent).toBe(25);
    expect(metrics.roundPosition).toBe(5);
  });

  it("clamps restored or malformed values safely", () => {
    const metrics = resolveStudyProgressMetrics({
      mode: "mastery",
      overallTotal: 10,
      masteredTotal: 99,
      currentIndex: 99,
      currentRoundTotal: 15,
    });

    expect(metrics.overallCompleted).toBe(10);
    expect(metrics.overallRemaining).toBe(0);
    expect(metrics.overallPercent).toBe(100);
    expect(metrics.roundPosition).toBe(15);
    expect(metrics.roundPercent).toBe(100);
  });
});
