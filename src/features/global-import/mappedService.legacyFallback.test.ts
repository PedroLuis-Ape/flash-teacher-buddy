import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/global-import/mappedService.ts"), "utf8");

describe("Super Importer legacy RPC fallback", () => {
  it("falls back to the official v1 RPC when v2 is absent from the schema cache", () => {
    expect(source).toContain('"import_app_piteco_super_package_v1"');
    expect(source).toContain("isMissingRpcSchemaCacheError");
    expect(source).toContain("options.officialPackage");
    expect(source).toContain('options.officialPackage.version === "1.0"');
  });

  it("does not require folder-glossary RPCs after the legacy v1 transaction", () => {
    expect(source).toContain("usedLegacyOfficialFallback");
    expect(source).toContain("glossary_created: 0");
    expect(source).toContain("glossary_updated: 0");
    expect(source).toContain("glossary_skipped: 0");
  });
});
