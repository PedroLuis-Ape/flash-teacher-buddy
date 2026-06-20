import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const modal = readFileSync(
  new URL("./StudyCompletionModal.impl.tsx", import.meta.url),
  "utf8",
);

describe("Study completion integration", () => {
  it("delegates completion through the shared callback", () => {
    expect(modal).toContain("onClick={onComplete}");
  });

  it("keeps restart and exit actions independent", () => {
    expect(modal).toContain("onClick={onRestart}");
    expect(modal).toContain("onClick={onExit}");
  });
});
