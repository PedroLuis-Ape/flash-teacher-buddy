import { describe, expect, it } from "vitest";
import { isSuperImportTestRolloutEnabled } from "./testRollout";

describe("Super Importador legacy fallback", () => {
  it("honors the explicit storage command from the legacy button", () => {
    expect(isSuperImportTestRolloutEnabled({
      search: "",
      envValue: "true",
      storageValue: "disabled",
    })).toBe(false);
  });

  it("lets an explicit test URL reopen the wizard", () => {
    expect(isSuperImportTestRolloutEnabled({
      search: "?superImport=test",
      envValue: "false",
      storageValue: "disabled",
    })).toBe(true);
  });
});
