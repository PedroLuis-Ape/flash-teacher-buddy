import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL(
  "../../../../supabase/migrations/20260801143000_study_persistence_context_v1.sql",
  import.meta.url,
));

describe("study persistence context migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("is additive and creates the explicit session context", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS session_scope_key text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS settings_snapshot jsonb");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS session_snapshot jsonb");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_study_sessions_active_scope_v1");
    expect(sql).toContain("NOTIFY pgrst");
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });

  it("allows every mode persisted by the engine without dropping data", () => {
    for (const mode of ["flip", "multiple-choice", "write", "mixed", "mixed-adaptive", "unscramble", "pronunciation"]) {
      expect(sql).toContain(`'${mode}'`);
    }
    expect(sql).toContain("DROP CONSTRAINT");
    expect(sql).toContain("preserved");
  });
});
