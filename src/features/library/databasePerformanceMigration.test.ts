import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260711195000_optimize_user_list_activity_access.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("user list activity performance migration", () => {
  it("adds the list-leading covering index used by folder list queries", () => {
    expect(migration).toContain("idx_user_list_activity_list_user");
    expect(migration).toMatch(/user_list_activity\s*\(list_id,\s*user_id\)/i);
  });

  it("evaluates auth.uid once per statement in all activity policies", () => {
    expect(migration.match(/\(SELECT auth\.uid\(\)\)/g)).toHaveLength(4);
    expect(migration).not.toMatch(/\bUSING\s*\(\s*auth\.uid\(\)/i);
    expect(migration).not.toMatch(/\bWITH CHECK\s*\(\s*auth\.uid\(\)/i);
  });

  it("preserves authenticated-only ownership policies", () => {
    expect(migration).toContain('CREATE POLICY "Users can view their own activity"');
    expect(migration).toContain('CREATE POLICY "Users can insert their own activity"');
    expect(migration).toContain('CREATE POLICY "Users can update their own activity"');
    expect(migration.match(/TO authenticated/g)).toHaveLength(3);
    expect(migration).not.toContain("TO anon");
    expect(migration).not.toContain("TO public");
  });
});
