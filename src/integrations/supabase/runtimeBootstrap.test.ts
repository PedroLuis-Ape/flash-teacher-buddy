import { describe, expect, it } from "vitest";
import {
  OFFICIAL_RUNTIME_ENDPOINT,
  OFFICIAL_SUPABASE_PROJECT_ID,
  validateOfficialRuntime,
} from "./runtimeBootstrap";

describe("official Supabase runtime bootstrap", () => {
  it("accepts the official public runtime payload", () => {
    expect(validateOfficialRuntime({
      projectId: OFFICIAL_SUPABASE_PROJECT_ID,
      url: `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`,
      publishableKey: "sb_publishable_test",
    })).toEqual({
      projectId: OFFICIAL_SUPABASE_PROJECT_ID,
      url: `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`,
      publicValue: "sb_publishable_test",
    });
    expect(OFFICIAL_RUNTIME_ENDPOINT).toContain("/functions/v1/app-public-config");
  });

  it("rejects a runtime from the retired project", () => {
    expect(() => validateOfficialRuntime({
      projectId: "ymahldldyxvwjeruaxpr",
      url: "https://ymahldldyxvwjeruaxpr.supabase.co",
      publishableKey: "sb_publishable_wrong",
    })).toThrow("projeto Supabase diferente");
  });

  it("rejects mismatched project id and URL", () => {
    expect(() => validateOfficialRuntime({
      projectId: OFFICIAL_SUPABASE_PROJECT_ID,
      url: "https://example.supabase.co",
      publicValue: "test",
    })).toThrow("projeto Supabase diferente");
  });
});
