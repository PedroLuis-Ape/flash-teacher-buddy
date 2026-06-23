import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const modal = readFileSync(
  new URL("./StudyCompletionModal.impl.tsx", import.meta.url),
  "utf8",
);

describe("Study completion integration", () => {
  it("delegates completion through the shared transition callback", () => {
    expect(modal).toContain("runTransition(onComplete)");
    expect(modal).toContain("playNext();");
  });

  it("keeps restart and exit actions independent", () => {
    expect(modal).toContain("runTransition(onRestart)");
    expect(modal).toContain("runTransition(onExit)");
  });

  it("plays the round cue when the completion dialog opens", () => {
    expect(modal).toContain("playRound();");
    expect(modal).toContain("wasOpenRef.current = open");
  });
});
