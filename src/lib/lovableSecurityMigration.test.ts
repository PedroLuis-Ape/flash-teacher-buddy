import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729152705_harden_catalog_and_remove_obsolete_rls.sql",
  ),
  "utf8",
);

describe("Lovable security migration contract", () => {
  it("restricts both store catalogs at the database boundary", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Anyone can view active skins"');
    expect(migration).toContain('CREATE POLICY "Public can view published active skins"');
    expect(migration).toContain("is_active IS TRUE");
    expect(migration).toContain("approved IS TRUE");
    expect(migration.match(/status = 'published'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves review, inventory and pending-gift access", () => {
    expect(migration).toContain('CREATE POLICY "Developer admins can view all skins"');
    expect(migration).toContain('CREATE POLICY "Owners can view acquired skins"');
    expect(migration).toContain('CREATE POLICY "Recipients can view pending gift skins"');
    expect(migration).toContain(
      'CREATE POLICY "Developer admins can view all public catalog items"',
    );
    expect(migration).toContain(
      'CREATE POLICY "Owners can view acquired public catalog items"',
    );
  });

  it("removes inert deny-all and overbroad flashcard policies", () => {
    for (const table of [
      "announcements",
      "classes",
      "class_members",
      "threads",
      "notifications",
      "messages",
    ]) {
      expect(migration).toContain(
        `DROP POLICY IF EXISTS "Deny all access to ${table}"`,
      );
    }

    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users or public portal can view flashcards from shared lists"',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Authenticated or public portal can view flashcards from collections"',
    );
    expect(migration).toContain(
      'CREATE POLICY "Anonymous users can view public collection flashcards"',
    );
    expect(migration).toContain("TO anon");
    expect(migration).not.toContain("DELETE FROM");
    expect(migration).not.toContain("TRUNCATE ");
  });
});
