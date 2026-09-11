import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

describe("study feedback visual contract", () => {
  it("keeps feedback states explicit and calm on mobile", () => {
    const source = read("src/features/study/components/StudyFeedbackPanel.tsx");

    expect(source).toContain("data-feedback-status={status}");
    expect(source).toContain("motion-reduce:animate-none");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("touch-manipulation");
    expect(source).toContain("flex-wrap");
  });

  it("keeps completion actions bounded and easy to operate", () => {
    const source = read("src/features/study/components/StudyCompletionModal.impl.tsx");

    expect(source).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(source).toContain("ape-overlay-scroll");
    expect(source).toContain("motion-reduce:animate-none");
    expect(source).toContain("min-h-11");
    expect(source).toContain("touch-manipulation");
  });
});
