import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./StudyCompletionModal.impl.tsx", import.meta.url),
  "utf8",
);

describe("StudyCompletionModal completion flow", () => {
  it("clears the persisted resume snapshot before finishing the session", () => {
    expect(source).toContain('import { clearStudyResume } from "@/features/study/lib/studyResume"');
    expect(source).toContain("if (user?.id) clearStudyResume(user.id)");
    expect(source).toContain("onClick={handleComplete}");
  });

  it("keeps restart and exit actions independent from resume cleanup", () => {
    expect(source).toContain('onClick={onRestart}');
    expect(source).toContain('onClick={onExit}');
  });
});
