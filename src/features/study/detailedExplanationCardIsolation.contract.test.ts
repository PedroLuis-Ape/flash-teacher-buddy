import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  "src/features/study/components/DetailedExplanationPanel.impl.tsx",
  "utf8",
);
const publisher = readFileSync(
  "src/features/study/hooks/useStudyResumePublisher.ts",
  "utf8",
);
const editor = readFileSync("src/components/EditFlashcardDialog.tsx", "utf8");

describe("detailed explanation card isolation", () => {
  it("publishes card and layer identity whenever study activity changes", () => {
    expect(publisher).toContain("setCurrentStudyCardIdentity(currentCardId, layerIndex)");
  });

  it("resets transient explanation state when card identity changes even if note props are equal", () => {
    expect(panel).toContain("subscribeCurrentStudyCardIdentity");
    expect(panel).toContain("cardIdentity.cardId");
    expect(panel).toContain("cardIdentity.layerIndex");
    expect(panel).toContain("setCurrentDetailedExplanation({ explanation, usageNotes, commonMistakes })");
  });

  it("keeps rich-note persistence scoped to the exact edited card", () => {
    expect(editor).toContain('.eq("id", flashcard.id)');
  });
});
