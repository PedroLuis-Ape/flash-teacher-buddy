import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260801203951_portal_playable_card_count.sql"),
  "utf8",
);

describe("portal playable card count migration", () => {
  it("is read-only, scoped and explicitly granted", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_portal_playable_card_count");
    expect(migration).toContain("STABLE");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = public, pg_temp");
    expect(migration).toContain("fc.deleted_at IS NULL");
    expect(migration).toContain("fc.user_id = owner_list.owner_id");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_portal_playable_card_count(uuid) FROM PUBLIC");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_portal_playable_card_count(uuid) TO anon, authenticated");
  });

  it("counts playable layered groups without counting aggregator rows", () => {
    expect(migration).toContain("standalone_cards AS");
    expect(migration).toContain("layered_groups AS");
    expect(migration).toContain("layer.parent_card_id = card.id");
    expect(migration).toContain("COALESCE(card.status_group_uid::text, card.parent_card_id::text)");
  });

  it("contains no write operation", () => {
    expect(migration).not.toMatch(/\b(?:insert|update|delete|truncate|drop)\b/i);
  });
});
