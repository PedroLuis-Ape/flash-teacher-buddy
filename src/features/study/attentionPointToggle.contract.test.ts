import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830120000_reversible_attention_points.sql",
  "utf8",
);
const attentionHook = readFileSync("src/hooks/useAttentionPoint.ts", "utf8");
const legacyHook = readFileSync("src/hooks/useSetSpecialLayer.ts", "utf8");
const specialHook = readFileSync("src/hooks/useSpecialFlashcards.ts", "utf8");
const studyPage = readFileSync("src/pages/Study.tsx", "utf8");

describe("reversible Points of attention contract", () => {
  it("has one canonical transactional ON/OFF RPC and an atomic bulk wrapper", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_user_attention_point(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_user_attention_points(");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_special_flashcards_active_group");
    expect(migration).toContain("is_active = false");
    expect(migration).toContain("materialization_group_id");
    expect(migration).toContain("DELETE FROM public.flashcard_progress");
    expect(migration).toContain("p.list_id = v_point.materialization_list_id");
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
    expect(specialHook).toContain("source_group_id, flashcard_id, materialization_group_id");
    expect(specialHook).not.toContain(".from('user_special_flashcards' as any)\n          .delete()");
    expect(studyPage).toContain("specialIds.includes(statusIdentity.canonicalGroupId)");
  });
});
