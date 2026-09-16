import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const reviewFlag = read("src/features/study/components/StudyReviewFlagButton.tsx");
const toolsCss = read("src/features/study/components/study-tools-menu.css");
const mixedStudy = read("src/pages/MixedStudy.tsx");

const gameFiles = [
  "src/features/study/components/FlipStudyView.impl.tsx",
  "src/features/study/components/WriteStudyView.impl.tsx",
  "src/features/study/components/MultipleChoiceStudyView.impl.tsx",
  "src/features/study/components/UnscrambleStudyView.impl.tsx",
  "src/features/study/components/PronunciationStudyView.impl.tsx",
];

describe("study control layout", () => {
  it("keeps the review flag in the shared tools rail instead of overlaying card content", () => {
    expect(reviewFlag).toContain("createPortal(button, portalHost)");
    expect(reviewFlag).toContain("[data-study-tools-slot='true']");
    expect(reviewFlag).toContain("study-review-flag-toolbar-button");
    expect(reviewFlag).not.toContain('"absolute right-2 top-2 z-20');
  });

  it("reserves responsive toolbar space for the review flag", () => {
    expect(toolsCss).toContain("gap: 0.5rem");
    expect(toolsCss).toContain(".study-review-flag-toolbar-button");
    expect(toolsCss).toContain("flex: 0 0 2.5rem");
    expect(toolsCss).toContain("flex: 1 1 0");
    expect(toolsCss).toContain("width: auto");
  });

  it("covers every primary mode and the Mixed Study runtime with the shared controls", () => {
    for (const file of gameFiles) {
      const source = read(file);
      expect(source, file).toContain("StudyToolsMenu");
      expect(source, file).toContain("StudyReviewFlagButton");
    }

    expect(mixedStudy).toContain("onToggleReviewFlag");
  });
});
