import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260712223000_atomic_layered_card_groups.sql"),
  "utf8",
);

describe("atomic layered-card groups migration", () => {
  it("publishes one authenticated RPC for complete group saves", () => {
    expect(migration).toContain("save_layered_card_group_v2");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("REVOKE ALL");
    expect(migration).toContain("TO authenticated");
  });

  it("requires two to five hundred arbitrary A/B layers", () => {
    expect(migration).toContain("jsonb_array_length(_layers) < 2");
    expect(migration).toContain("jsonb_array_length(_layers) > 500");
    expect(migration).toContain("front");
    expect(migration).toContain("back");
    expect(migration).not.toContain("present");
    expect(migration).not.toContain("past");
    expect(migration).not.toContain("future");
  });

  it("reorders safely and soft-deletes omitted children", () => {
    expect(migration).toContain("1000000 + ordered.layer_index");
    expect(migration).toContain("deleted_at = now()");
    expect(migration).toContain("v_kept_ids");
  });
});