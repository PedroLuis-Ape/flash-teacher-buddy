import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync("src/features/study/components/StudyFeedbackPanel.tsx", "utf8");
const write = readFileSync("src/features/study/components/WriteStudyView.impl.tsx", "utf8");

describe("rewrite feedback other side", () => {
  it("renders the other side as a secondary block with its own audio", () => {
    expect(panel).toContain('data-feedback-other-side="true"');
    expect(panel).toContain("Outro lado");
    expect(panel).toContain("otherSideAnswer");
    expect(panel).toContain("onPlayOtherSideAnswer");
    expect(panel).toContain("playOtherSideAriaLabel");
  });

  it("uses the real opposite side of the current card and layer", () => {
    expect(write).toContain('resolvedRewriteSide === "a" ? sideB : sideA');
    expect(write).toContain("rewriteOtherSide.label");
    expect(write).toContain("toBCP47(rewriteOtherSide.lang)");
  });

  it("shows the other side in every rewrite feedback panel without a modal", () => {
    const spreads = write.split("{...rewriteOtherSideProps}").length - 1;
    expect(spreads).toBe(3);
    expect(panel).not.toContain("Dialog");
  });

  it("does not hardcode English or Portuguese labels", () => {
    expect(write.slice(write.indexOf("rewriteOtherSide"))).not.toContain('"English"');
    expect(write.slice(write.indexOf("rewriteOtherSide"))).not.toContain('"Português"');
  });
});

