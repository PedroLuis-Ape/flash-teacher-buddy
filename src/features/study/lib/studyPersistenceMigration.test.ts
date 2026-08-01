import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stableIdentitySql = readFileSync(
  new URL("../../../../supabase/migrations/20260801153000_preserve_stable_status_identity_v1.sql", import.meta.url),
  "utf8",
);
const progressSql = readFileSync(
  new URL("../../../../supabase/migrations/20260801153500_atomic_flashcard_progress_v1.sql", import.meta.url),
  "utf8",
);

describe("study persistence migrations", () => {
  it("preserves stable layered identity and transfers status on unmerge", () => {
    expect(stableIdentitySql).toContain("status_group_uid = gen_random_uuid()");
    expect(stableIdentitySql).toContain("parent_status_group_uid");
    expect(stableIdentitySql).toContain("RETURNING status_group_uid INTO v_new_group");
    expect(stableIdentitySql).toContain("new_status_group_uid', v_new_group");
    expect(stableIdentitySql).toContain("REVOKE ALL ON FUNCTION public.unmerge_flashcard_from_group(uuid)");
  });

  it("uses an idempotent atomic writer without granting direct event-table writes", () => {
    expect(progressSql).toContain("UNIQUE (user_id, operation_id)");
    expect(progressSql).toContain("record_flashcard_progress_v1");
    expect(progressSql).toContain("ON CONFLICT (user_id, operation_id) DO NOTHING");
    expect(progressSql).toContain("ON CONFLICT (user_id, flashcard_id) DO UPDATE");
    expect(progressSql).toContain("REVOKE ALL ON TABLE public.study_progress_events FROM anon, authenticated");
  });
});
