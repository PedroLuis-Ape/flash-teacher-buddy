import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../../supabase/migrations/20260712170000_user_study_preferences.sql", import.meta.url),
  "utf8",
);

describe("study preferences migration", () => {
  it("creates global and per-list preference tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.user_study_preferences");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.user_list_study_preferences");
  });

  it("constrains supported preset values", () => {
    expect(sql).toContain("user_study_preferences_mode_check");
    expect(sql).toContain("user_study_preferences_direction_check");
    expect(sql).toContain("user_study_preferences_card_order_check");
    expect(sql).toContain("user_study_preferences_scope_check");
  });

  it("enables rls and creates ownership policies", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql.match(/\(SELECT auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("FOR DELETE");
  });

  it("indexes list lookup and updated timestamps", () => {
    expect(sql).toContain("idx_user_list_study_preferences_list_user");
    expect(sql).toContain("idx_user_study_preferences_updated_at");
  });
});
