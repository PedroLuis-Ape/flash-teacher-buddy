import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260902090000_separate_attention_and_reinforcement.sql",
  "utf8",
);
const hook = readFileSync("src/hooks/useReinforcement.ts", "utf8");
const page = readFileSync("src/pages/Reinforcement.tsx", "utf8");
const study = readFileSync("src/pages/Study.tsx", "utf8");
const home = readFileSync("src/pages/Index.tsx", "utf8");

describe("Reforço separation contract", () => {
  it("has an institution-scoped canonical table and idempotent ON/OFF RPC", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.user_reinforcement_points");
    expect(migration).toContain("institution_id uuid");
    expect(migration).toContain("source_group_uid uuid NOT NULL");
    expect(migration).toContain("uq_user_reinforcement_active_institution_group");
    expect(migration).toContain("uq_user_reinforcement_active_general_group");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_user_reinforcement_point(");
    expect(migration).toContain("set_user_reinforcement_points");
    expect(migration).toContain("is_active = false");
  });

  it("clones the full study group and retires only owned materializations", () => {
    expect(migration).toContain("detailed_explanation");
    expect(migration).toContain("usage_notes");
    expect(migration).toContain("common_mistakes");
    expect(migration).toContain("accepted_answers_en");
    expect(migration).toContain("accepted_answers_pt");
    expect(migration).toContain("c.layer_index");
    expect(migration).toContain("c.user_id = v_uid");
    expect(migration).toContain("DELETE FROM public.flashcard_progress");
  });

  it("keeps system collections readonly and separate from attention", () => {
    expect(migration).toContain("system_kind IN ('user', 'attention_points', 'reinforcement')");
    expect(migration).toContain("System collections are immutable to the client");
    expect(migration).toContain("DROP TRIGGER IF EXISTS trg_cleanup_user_attention_materialization");
    expect(migration).toContain("app.allow_system_collection_mutation");
    expect(migration).toContain("Coleção automática é somente leitura.");
    expect(migration).toContain("Cards de coleção automática são somente leitura.");
    expect(migration).toContain("v_old_kind");
    expect(migration).toContain("v_new_kind");
    expect(migration).toContain("COALESCE(v_old_kind, 'user')");
    expect(migration).toContain("COALESCE(v_new_kind, 'user')");
    expect(hook).toContain('rpc("set_user_reinforcement_point"');
    expect(hook).toContain("reinforcementKeys");
   expect(page).toContain("Estudar agora");
   expect(page).toContain("somente leitura");
    expect(page).toContain("items.length === 1 ? \"card\" : \"cards\"");
    expect(study).toContain("Adicionar ao Reforço");
    expect(study).toContain("isSystemCollection");
    expect(study).toContain("onToggleFavorite={!isSystemCollection ? handleToggleFavorite : undefined}");
    expect(study).toContain("onToggleRedList={!isSystemCollection ? handleToggleRedList : undefined}");
  });

  it("does not promote an empty reinforcement area on Home", () => {
    expect(home).toContain("reinforcementCount > 0 &&");
    expect(home).toContain("navigate('/reinforcement')");
  });
});
