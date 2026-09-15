from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"marker not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str, expected_min: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text and old not in text:
        return
    count = text.count(old)
    if count < expected_min:
        raise SystemExit(f"expected at least {expected_min} markers in {path}, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


# Mixed Study: one query/mutation owner, exact visible-card identity, same props as Study.
replace_once(
    "src/pages/MixedStudy.tsx",
    'import { useSetSpecialLayer } from "@/hooks/useSetSpecialLayer";\n',
    'import { useSetSpecialLayer } from "@/hooks/useSetSpecialLayer";\n'
    'import { useFlashcardReviewFlags, useFlashcardReviewFlagMutation } from "@/hooks/useFlashcardReviewFlags";\n',
)

replace_once(
    "src/pages/MixedStudy.tsx",
    '  const resolvedDirection: Direction = baseDirection === "any"\n',
    '''  const { flaggedIds: reviewFlaggedIds } = useFlashcardReviewFlags(userId);\n  const reviewFlagMutation = useFlashcardReviewFlagMutation(userId);\n  const currentReviewCardId = statusIdentity.visibleLayerId ?? currentCard?.id ?? null;\n  const isCurrentReviewFlagged = Boolean(\n    currentReviewCardId && reviewFlaggedIds.has(currentReviewCardId),\n  );\n  const handleToggleReviewFlag = useCallback(() => {\n    if (!userId || !currentReviewCardId || reviewFlagMutation.isPending) return;\n    reviewFlagMutation.mutate({\n      flashcardId: currentReviewCardId,\n      enabled: !isCurrentReviewFlagged,\n      institutionId,\n    });\n  }, [\n    currentReviewCardId,\n    institutionId,\n    isCurrentReviewFlagged,\n    reviewFlagMutation,\n    userId,\n  ]);\n\n  const resolvedDirection: Direction = baseDirection === "any"\n''',
)

replace_all(
    "src/pages/MixedStudy.tsx",
    '''              isSpecial={isCurrentCardSpecial}\n              onToggleSpecial={handleToggleSpecial}\n''',
    '''              isSpecial={isCurrentCardSpecial}\n              onToggleSpecial={handleToggleSpecial}\n              isReviewFlagged={isCurrentReviewFlagged}\n              reviewFlagPending={reviewFlagMutation.isPending}\n              onToggleReviewFlag={handleToggleReviewFlag}\n''',
    expected_min=1,
)

replace_once(
    "src/pages/MixedStudy.tsx",
    '''    isSpecial: isCurrentCardSpecial,\n    onToggleSpecial: handleToggleSpecial,\n    rewriteSnapshotScope: mixedSnapshotKey,\n''',
    '''    isSpecial: isCurrentCardSpecial,\n    onToggleSpecial: handleToggleSpecial,\n    isReviewFlagged: isCurrentReviewFlagged,\n    reviewFlagPending: reviewFlagMutation.isPending,\n    onToggleReviewFlag: handleToggleReviewFlag,\n    rewriteSnapshotScope: mixedSnapshotKey,\n''',
)

# App route.
replace_once(
    "src/App.tsx",
    'const SpecialCards = lazy(() => import("./pages/SpecialCards"));\n',
    'const SpecialCards = lazy(() => import("./pages/SpecialCards"));\nconst ReviewCards = lazy(() => import("./pages/ReviewCards"));\n',
)
replace_once(
    "src/App.tsx",
    '                          <Route path="/special-cards" element={<SpecialCards />} />\n',
    '                          <Route path="/special-cards" element={<SpecialCards />} />\n                          <Route path="/review-cards" element={<ReviewCards />} />\n',
)

# Sidebar access + count badge.
replace_once(
    "src/components/layout/AppSidebar.tsx",
    '  Home, Library, Store, User, GraduationCap, Search, Globe, Gem, Sparkles, MessageSquareWarning\n',
    '  Home, Library, Store, User, GraduationCap, Search, Globe, Gem, Sparkles, MessageSquareWarning, Flag\n',
)
replace_once(
    "src/components/layout/AppSidebar.tsx",
    'import { prefetchRoute } from "@/lib/routePrefetch";\n',
    'import { prefetchRoute } from "@/lib/routePrefetch";\nimport { useAuthUser } from "@/hooks/useAuthUser";\nimport { useFlashcardReviewFlagCount } from "@/hooks/useFlashcardReviewFlags";\n',
)
replace_once(
    "src/components/layout/AppSidebar.tsx",
    '''  const navigate = useNavigate();\n  const location = useLocation();\n''',
    '''  const navigate = useNavigate();\n  const location = useLocation();\n  const { userId } = useAuthUser();\n  const reviewFlagCount = useFlashcardReviewFlagCount(userId);\n''',
)
replace_once(
    "src/components/layout/AppSidebar.tsx",
    '''              <Button\n                variant={location.pathname === '/import/super' ? "secondary" : "ghost"}\n''',
    '''              <Button\n                variant={location.pathname === '/review-cards' ? "secondary" : "ghost"}\n                className={cn(\n                  "ape-motion-menu-item w-full justify-start gap-3",\n                  location.pathname === '/review-cards' && "bg-primary/10 text-primary font-medium"\n                )}\n                onMouseEnter={() => prefetchRoute('/review-cards')}\n                onTouchStart={() => prefetchRoute('/review-cards')}\n                onClick={() => {\n                  setIsOpen(false);\n                  navigate('/review-cards');\n                }}\n              >\n                <Flag className={cn("h-4 w-4", reviewFlagCount > 0 && "fill-rose-500 text-rose-500")} />\n                <span>Revisar cards</span>\n                {reviewFlagCount > 0 && (\n                  <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-rose-500">\n                    {reviewFlagCount > 99 ? "99+" : reviewFlagCount}\n                  </span>\n                )}\n              </Button>\n              <Button\n                variant={location.pathname === '/import/super' ? "secondary" : "ghost"}\n''',
)

# Intent prefetch and RUM normalization.
replace_once(
    "src/lib/routePrefetch.ts",
    "  '/search': () => import('@/pages/Search'),\n",
    "  '/search': () => import('@/pages/Search'),\n  '/review-cards': () => import('@/pages/ReviewCards'),\n",
)
replace_once(
    "src/lib/coreWebVitalsRum.ts",
    '  "/special-cards",\n',
    '  "/special-cards",\n  "/review-cards",\n',
)

# Robots: private account-specific route for both user-agent groups.
replace_all(
    "public/robots.txt",
    "Disallow: /special-cards\n",
    "Disallow: /special-cards\nDisallow: /review-cards\n",
    expected_min=2,
)
replace_once(
    "scripts/seo-visibility-eval.mjs",
    'const privatePatterns = ["/auth", "/dashboard", "/profile", "/settings/", "/special-cards", "/system-status"];\n',
    'const privatePatterns = ["/auth", "/dashboard", "/profile", "/settings/", "/special-cards", "/review-cards", "/system-status"];\n',
)

# Regression contract: static by design, guards cross-cutting wiring without a fragile browser harness.
Path("src/features/study/reviewCardsFeature.contract.test.ts").write_text(r'''import { readFileSync } from "node:fs";
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
''', encoding="utf-8")
