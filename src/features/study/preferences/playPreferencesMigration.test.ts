import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../../supabase/migrations/20260712193000_add_play_preset.sql", import.meta.url),
  "utf8",
);

describe("Play preference migration", () => {
  it("adds global and list Play columns with safe constraints", () => {
    expect(migration).toContain("ALTER TABLE public.user_study_preferences");
    expect(migration).toContain("ALTER TABLE public.user_list_study_preferences");
    expect(migration).toContain("play_mode");
    expect(migration).toContain("play_side");
    expect(migration).toContain("IN ('both', 'single')");
    expect(migration).toContain("IN ('a', 'b')");
  });

  it("preserves current behavior as the global default", () => {
    expect(migration).toMatch(/play_mode\s+text\s+NOT NULL\s+DEFAULT 'both'/i);
    expect(migration).toMatch(/play_side\s+text\s+NOT NULL\s+DEFAULT 'a'/i);
  });

  it("keeps per-list fields nullable for minimal overrides", () => {
    expect(migration).toMatch(/user_list_study_preferences[\s\S]*play_mode\s+text\s+NULL/i);
    expect(migration).toMatch(/user_list_study_preferences[\s\S]*play_side\s+text\s+NULL/i);
  });
});