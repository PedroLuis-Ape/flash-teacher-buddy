import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const baseMigration = read("supabase/migrations/20260915120000_user_flashcard_review_flags.sql");
const finalMigration = read("supabase/migrations/20260915133000_finalize_user_flashcard_review_flags.sql");
const hook = read("src/hooks/useFlashcardReviewFlags.ts");
const button = read("src/features/study/components/StudyReviewFlagButton.tsx");
const study = read("src/pages/Study.tsx");
const mixed = read("src/pages/MixedStudy.tsx");
const reviewPage = read("src/pages/ReviewCards.tsx");
const app = read("src/App.tsx");
const sidebar = read("src/components/layout/AppSidebar.tsx");

const gameFiles = [
  "src/features/study/components/FlipStudyView.impl.tsx",
  "src/features/study/components/WriteStudyView.impl.tsx",
  "src/features/study/components/MultipleChoiceStudyView.impl.tsx",
  "src/features/study/components/UnscrambleStudyView.impl.tsx",
  "src/features/study/components/PronunciationStudyView.impl.tsx",
];

describe("Revisar cards — feature contract", () => {
  it("uses exact flashcard identity and soft resolution, never group uniqueness or card cloning", () => {
    expect(baseMigration).toContain("(user_id, flashcard_id)");
    expect(baseMigration).not.toMatch(/UNIQUE[^;]*source_group_uid/i);
    expect(finalMigration).toContain("flashcard_id = _flashcard_id");
    expect(finalMigration).toContain("is_active = false");
    expect(finalMigration).toContain("resolved_at = now()");
    expect(finalMigration).not.toMatch(/DELETE\s+FROM\s+public\.flashcards/i);
    expect(finalMigration).not.toMatch(/INSERT\s+INTO\s+public\.flashcards/i);
  });

  it("keeps the review queue separate from Pontos de atenção", () => {
    expect(hook).toContain('const TABLE = "user_flashcard_review_flags"');
    expect(hook).not.toContain('queryKey: ["special-flashcards"');
    expect(finalMigration).not.toContain("user_special_flashcards");
    expect(finalMigration).not.toContain("set_user_attention_point");
  });

  it("keeps the in-game flag one-click and isolated from card gestures", () => {
    expect(button).toContain('type="button"');
    expect(button).toContain("onPointerDown");
    expect(button).toContain("onTouchStart");
    expect(button).toContain("event.stopPropagation()");
    expect(button).toContain("if (isPending) return");
  });

  it("wires the marker through all primary study modes", () => {
    expect(study).toContain("useFlashcardReviewFlags(authUserId)");
    expect(study).toContain("useFlashcardReviewFlagMutation(authUserId)");
    expect(study.match(/onToggleReviewFlag=\{reviewFlagToggleHandler\}/g)?.length).toBe(5);
    for (const file of gameFiles) {
      const source = read(file);
      expect(source, file).toContain("StudyReviewFlagButton");
      expect(source, file).toContain("onToggleReviewFlag");
    }
  });

  it("wires MixedStudy to the same exact-card queue without per-mode Supabase reads", () => {
    expect(mixed).toContain("useFlashcardReviewFlags(userId)");
    expect(mixed).toContain("useFlashcardReviewFlagMutation(userId)");
    expect(mixed).toContain("statusIdentity.visibleLayerId ?? currentCard?.id");
    expect(mixed).toContain("isReviewFlagged: isCurrentReviewFlagged");
    expect(mixed).toContain("onToggleReviewFlag: handleToggleReviewFlag");
    expect(mixed).toContain("onToggleReviewFlag={handleToggleReviewFlag}");
  });

  it("provides a private inbox that edits the original and resolves only on explicit action", () => {
    expect(app).toContain('path="/review-cards"');
    expect(sidebar).toContain('navigate(\'/review-cards\')');
    expect(reviewPage).toContain("<EditFlashcardDialog");
    expect(reviewPage).toContain('.from("flashcards")');
    expect(reviewPage).toContain('.eq("id", flashcardId)');
    expect(reviewPage).toContain("A revisão continua aberta");
    expect(reviewPage).toContain("enabled: false");
    expect(reviewPage).not.toMatch(/\.delete\(\)/);
  });

  it("keeps review metadata separate from original content editing", () => {
    expect(finalMigration).toContain("update_user_flashcard_review_flag_metadata");
    expect(finalMigration).toContain("reason = v_reason");
    expect(finalMigration).toContain("note = v_note");
    expect(hook).toContain("useFlashcardReviewFlagMetadataMutation");
    expect(reviewPage).toContain("Detalhes da revisão");
  });
});
