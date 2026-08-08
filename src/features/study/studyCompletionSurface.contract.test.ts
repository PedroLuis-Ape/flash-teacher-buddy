import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const study = readFileSync(new URL("../../pages/Study.tsx", import.meta.url), "utf8");

describe("study completion surface", () => {
  it("uses the shared completion action for complete sessions", () => {
    expect(study).toContain("if (isFinished && isGameComplete)");
    expect(study).toContain("<StudyCompletionModal");
    expect(study).toContain("onRestart={() => void handleRestartWithSettings()}");
  });

  it("uses the round action surface before starting the next mastery round", () => {
    expect(study).toContain("<RoundSummaryDialog");
    expect(study).toContain("onNextRound={() => void startNextRound()}");
    expect(study).toContain("onExit={handleExit}");
  });
});
