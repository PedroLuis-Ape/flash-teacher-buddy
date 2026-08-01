import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stableIdentitySql = readFileSync(
  new URL("../../../../supabase/migrations/20260801153000_preserve_stable_status_identity_v1.sql", import.meta.url),
  "utf8",
);
const mixedModeSql = readFileSync(
  new URL("../../../../supabase/migrations/20260801120000_allow_mixed_adaptive_study_sessions.sql", import.meta.url),
  "utf8",
);
const persistenceContextSql = readFileSync(
  new URL("../../../../supabase/migrations/20260801143000_study_persistence_context_v1.sql", import.meta.url),
  "utf8",
);
const progressSql = readFileSync(
  new URL("../../../../supabase/migrations/20260801153500_atomic_flashcard_progress_v1.sql", import.meta.url),
  "utf8",
);
const claimSessionSql = readFileSync(
  new URL("../../../../supabase/migrations/20260801160000_claim_study_session_v1.sql", import.meta.url),
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
    expect(progressSql).toContain("study_access_denied");
    expect(progressSql).toContain("f.list_id = p_list_id");
    expect(progressSql).toContain("public.is_turma_member");
  });

  it("only replaces the known study-session mode constraint", () => {
    for (const migration of [mixedModeSql, persistenceContextSql]) {
      expect(migration).toContain("DROP CONSTRAINT IF EXISTS study_sessions_mode_check");
      expect(migration).not.toContain("pg_get_constraintdef");
      expect(migration).not.toContain("FOR existing_constraint");
      expect(migration).not.toContain("EXECUTE format(");
    }
    expect(persistenceContextSql).toContain("study_sessions_mode_check_v1");
  });

  it("serializes concurrent session claims without deleting legacy rows", () => {
    expect(claimSessionSql).toContain("claim_study_session_v1");
    expect(claimSessionSql).toContain("pg_advisory_xact_lock");
    expect(claimSessionSql).toContain("FOR UPDATE");
    expect(claimSessionSql).toContain("study_access_denied");
    expect(claimSessionSql).toContain("public.is_turma_owner");
    expect(claimSessionSql).toContain("public.is_turma_member");
    expect(claimSessionSql).toContain("RETURNING * INTO v_session");
    expect(claimSessionSql).toContain("REVOKE ALL ON FUNCTION public.claim_study_session_v1");
    expect(claimSessionSql).toContain("GRANT EXECUTE ON FUNCTION public.claim_study_session_v1");
    expect(claimSessionSql).not.toContain("DELETE FROM public.study_sessions");
    expect(claimSessionSql).not.toContain("DROP TABLE");
  });
});
