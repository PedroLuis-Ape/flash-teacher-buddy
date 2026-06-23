import { describe, expect, it } from "vitest";
import {
  getSuperImportMode,
  isSuperImportLegacyForced,
  isSuperImportTestRolloutEnabled,
} from "./testRollout";

describe("Super Importador controlled rollout", () => {
  it("enables the wizard through the explicit test query", () => {
    expect(isSuperImportTestRolloutEnabled({
      search: "?superImport=test",
      envValue: "false",
    })).toBe(true);
  });

  it("accepts the v3 and wizard aliases", () => {
    expect(isSuperImportTestRolloutEnabled({ search: "?superImport=v3" })).toBe(true);
    expect(isSuperImportTestRolloutEnabled({ search: "?superImport=wizard" })).toBe(true);
  });

  it("enables the wizard through the test environment flag", () => {
    expect(isSuperImportTestRolloutEnabled({
      search: "",
      envValue: "true",
    })).toBe(true);
  });

  it("keeps the rollout disabled by default", () => {
    expect(isSuperImportTestRolloutEnabled({
      search: "",
      envValue: "false",
    })).toBe(false);
  });

  it("lets the legacy query override an enabled environment flag", () => {
    expect(isSuperImportTestRolloutEnabled({
      search: "?superImport=legacy",
      envValue: "true",
    })).toBe(false);
    expect(isSuperImportLegacyForced("?superImport=legacy")).toBe(true);
  });

  it("normalizes query values", () => {
    expect(getSuperImportMode("?superImport=%20TEST%20")).toBe("test");
  });
});
