import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830120000_reversible_attention_points.sql",
  "utf8",
);
const separationMigration = readFileSync(
  "supabase/migrations/20260902090000_separate_attention_and_reinforcement.sql",
  "utf8",
);
const attentionHook = readFileSync("src/hooks/useAttentionPoint.ts", "utf8");
const legacyHook = readFileSync("src/hooks/useSetSpecialLayer.ts", "utf8");
const specialHook = readFileSync("src/hooks/useSpecialFlashcards.ts", "utf8");
const studyPage = readFileSync("src/pages/Study.tsx", "utf8");
const mixedStudyPage = readFileSync("src/pages/MixedStudy.tsx", "utf8");
const studyToolsMenu = readFileSync("src/features/study/components/StudyToolsMenu.tsx", "utf8");

describe("reversible Points of attention contract", () => {
  it("keeps the historical migration and evolves the live attention RPC without cloning", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_user_attention_point(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_user_attention_points(");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_special_flashcards_active_group");
    const attentionRpcStart = separationMigration.indexOf(
      "CREATE OR REPLACE FUNCTION public.set_user_attention_point(",
    );
    const reinforcementRpcStart = separationMigration.indexOf(
      "CREATE OR REPLACE FUNCTION public.set_user_reinforcement_point(",
    );
    const attentionRpc = separationMigration.slice(attentionRpcStart, reinforcementRpcStart);
    expect(attentionRpc).toContain("source_group_id");
    expect(attentionRpc).toContain("materialization_group_id = NULL");
    expect(attentionRpc).not.toContain("INSERT INTO public.flashcards");
    expect(attentionRpc).not.toContain("DELETE FROM public.flashcard_progress");
  });

  it("can recover when the focus migration was not committed", () => {
    expect(separationMigration).toContain("ADD COLUMN IF NOT EXISTS focus_text text");
    expect(separationMigration).toContain("ADD COLUMN IF NOT EXISTS focus_side text");
    expect(separationMigration).toContain("CREATE TABLE IF NOT EXISTS public.user_attention_areas");
    expect(separationMigration).toContain("retained as inactive history");
  });

  it("retires only derived clones and preserves the source group", () => {
    expect(migration).toContain("c.user_id = v_uid");
    expect(migration).toContain("c.id = v_point.materialization_group_id");
    expect(migration).toContain("c.parent_card_id = v_point.materialization_group_id");
    expect(migration).not.toContain("UPDATE public.flashcards SET deleted_at = now() WHERE id = v_source_group_id");
  });

  it("routes compatibility callers through the shared client service", () => {
    expect(attentionHook).toContain('rpc("set_user_attention_point"');
    expect(attentionHook).toContain('rpc("set_user_attention_points"');
    expect(legacyHook).toContain("useAttentionPointMutation");
    expect(specialHook).toContain("source_group_id, flashcard_id");
    expect(specialHook).not.toContain("row.materialization_group_id");
    expect(specialHook).not.toContain(".from('user_special_flashcards' as any)\n          .delete()");
    expect(studyPage).toContain("specialIds.includes(statusIdentity.canonicalGroupId)");
    expect(studyPage.match(/onToggleSpecial=\{specialToggleHandler\}/g)?.length).toBe(5);
  });

  it("keeps the in-game action visible and wires Prática Mista to the same mutation", () => {
    expect(studyToolsMenu).toContain("alwaysShowLabel");
    expect(studyToolsMenu).toContain('visibleLabel={isSpecial ? "Ponto de atenção ✓" : "Ponto de atenção"}');
    expect(mixedStudyPage).toContain("useSetSpecialLayer");
    expect(mixedStudyPage).toContain("isSpecial: isCurrentCardSpecial");
    expect(mixedStudyPage).toContain("onToggleSpecial: handleToggleSpecial");
    expect(mixedStudyPage).toContain("onToggleSpecial={handleToggleSpecial}");
  });
});
