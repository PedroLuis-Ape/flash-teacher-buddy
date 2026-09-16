import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const selectorSource = readFileSync(
  new URL("./ListStudyTypeSelector.tsx", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../../../../supabase/migrations/20260916023000_promote_list_language_authority_on_settings_save.sql", import.meta.url),
  "utf8",
);

describe("list A/B authority editing contract", () => {
  it("lets the user choose list-owned or folder-inherited language authority", () => {
    expect(selectorSource).toContain("Usar configuração desta lista");
    expect(selectorSource).toContain("Herdar configuração da pasta");
    expect(selectorSource).toContain('languageSettingsMode: "explicit"');
    expect(selectorSource).toContain('languageSettingsMode: "inherited"');
  });

  it("persists language_settings_mode whenever an explicit authority was selected", () => {
    expect(selectorSource).toContain("columns.language_settings_mode = settings.languageSettingsMode");
  });

  it("promotes an unchanged-value A/B settings save to explicit without rewriting legacy rows in bulk", () => {
    expect(migrationSource).toContain("NEW.language_settings_mode := 'explicit'");
    expect(migrationSource).toContain("IF NEW.language_settings_mode IS DISTINCT FROM OLD.language_settings_mode THEN");
    expect(migrationSource).not.toMatch(/UPDATE\s+public\.lists\s+SET\s+language_settings_mode/i);
  });
});
