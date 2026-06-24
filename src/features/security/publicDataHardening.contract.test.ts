import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20260624200000_harden_public_data_and_bug_report_trigger.sql";
const migration = readFileSync(migrationPath, "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("database security hardening", () => {
  it("keeps the canonical environment explicit", () => {
    expect(config).toContain("ymahldldyxvwjeruaxpr");
  });

  it("protects profile and study content base tables", () => {
    for (const table of ["profiles", "folders", "lists", "flashcards"]) {
      expect(migration).toContain(table);
    }
    expect(migration).toContain("REVOKE SELECT");
    expect(migration).toContain("pg_policies");
  });

  it("protects financial audit rows from direct writes", () => {
    expect(migration).toContain("pitecoin_transactions");
    expect(migration).toContain("exchange_logs");
    expect(migration).toContain("purchase_logs");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE");
  });

  it("keeps the report timestamp helper non-elevated", () => {
    expect(migration).toContain("set_bug_reports_updated_at");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("GRANT UPDATE (category, severity, title, description, page_url, metadata)");
  });

  it("records the intentional public glossary exception", () => {
    expect(migration).toContain("Intentional read-only public RPC");
    expect(migration).toContain("get_account_glossary_for_list_v1");
  });
});
