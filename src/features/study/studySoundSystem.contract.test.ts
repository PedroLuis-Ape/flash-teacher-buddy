import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("subtle study sound system", () => {
  it("provides distinct synthesized feedback patterns", () => {
    const source = read("src/lib/sfx.ts");

    expect(source).toContain("correct:");
    expect(source).toContain("wrong:");
    expect(source).toContain("next:");
    expect(source).toContain("round:");
    expect(source).toContain("createOscillator");
    expect(source).toContain("getPerfSettings().soundEffects");
    expect(source).toContain("timestamp - lastFeedbackAt < 260");
    expect(source).not.toContain("/sounds/correct.mp3");
  });

  it("plays transition and completion cues at shared UI boundaries", () => {
    const feedbackPanel = read("src/features/study/components/StudyFeedbackPanel.tsx");
    const completionModal = read("src/features/study/components/StudyCompletionModal.impl.tsx");

    expect(feedbackPanel).toContain("playNext();");
    expect(feedbackPanel).toContain("onClick={handleAction}");
    expect(completionModal).toContain("playRound();");
    expect(completionModal).toContain("runTransition");
  });
});
