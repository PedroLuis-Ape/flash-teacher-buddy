import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase/migrations/20260729175633_restore_ymah_import_engine_v2.sql",
);
const migration = readFileSync(migrationPath, "utf8").replace(/\r\n?/g, "\n");
const executableSql = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const migrationStatements = executableSql.replace(
  /AS \$\$[\s\S]*?\$\$;/g,
  "AS $$<function body>$$;",
);

describe("rich import engine recovery migration", () => {
  it("fails closed before changing the catalog when prerequisites are missing", () => {
    const preflightEnd = migration.indexOf("$preflight$;");
    const firstCatalogChange = migration.indexOf("ALTER TABLE public.global_import_batches");

    expect(migration).toContain("SET LOCAL lock_timeout = '5s'");
    expect(migration).toContain("E_IMPORT_ENGINE_PREFLIGHT");
    expect(migration).toContain("save_layered_card_group_v2");
    expect(preflightEnd).toBeGreaterThan(0);
    expect(firstCatalogChange).toBeGreaterThan(preflightEnd);
  });

  it("publishes the personal transactional gateway, undo, and capabilities contract", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_v2",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_v3",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.import_app_piteco_super_package_current",
    );
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.undo_global_import_v2");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_import_capabilities_v1");
    expect(migration).toContain("v_migration_revision := '20260729175633'");
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("keeps helper RPCs private and grants only authenticated public gateways", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.import_smart_list_content_v2_legacy(uuid,uuid,jsonb,text,uuid,text) FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.import_app_piteco_super_package_current(uuid,jsonb,jsonb,text,uuid) TO authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_import_capabilities_v1() TO authenticated",
    );
  });

  it("is atomic and contains no destructive data operation", () => {
    expect(executableSql.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(executableSql.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(migrationStatements).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migrationStatements).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationStatements).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it("preserves every import history entity type already supported by the schema", () => {
    expect(migration).toContain("'assignment'");
    expect(migration).toContain("'folder_glossary_snapshot'");
    expect(migration).toContain("VALIDATE CONSTRAINT global_import_items_entity_type_check");
  });
});

describe("current Supabase realtime schema compatibility", () => {
  it.each([
    "20260530030822_a2a84769-74ad-4716-b659-1c1cce332285.sql",
    "20260602165232_3dce1e61-50eb-4435-9f0e-7192679069d1.sql",
  ])("does not mutate the platform-owned realtime schema in %s", (filename) => {
    const source = readFileSync(join(root, "supabase/migrations", filename), "utf8");

    expect(source).not.toMatch(/\bALTER\s+TABLE\s+realtime\./i);
    expect(source).not.toMatch(/\bCREATE\s+POLICY[\s\S]*\bON\s+realtime\./i);
    expect(source).not.toMatch(/\bDROP\s+POLICY[\s\S]*\bON\s+realtime\./i);
  });
});
