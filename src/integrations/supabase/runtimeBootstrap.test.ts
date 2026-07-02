import { describe, expect, it } from "vitest";
import {
  MANAGED_SUPABASE_PROJECT_ID,
  OFFICIAL_RUNTIME_ENDPOINT,
  PRODUCTION_DATA_PROJECT_ID,
  validateOfficialRuntime,
} from "./runtimeBootstrap";

describe("Supabase runtime bootstrap", () => {
  it("accepts the production data runtime payload", () => {
    expect(validateOfficialRuntime({
      projectId: PRODUCTION_DATA_PROJECT_ID,
      url: `https://${PRODUCTION_DATA_PROJECT_ID}.supabase.co`,
      publishableKey: "test-public-value",
    })).toEqual({
      projectId: PRODUCTION_DATA_PROJECT_ID,
      url: `https://${PRODUCTION_DATA_PROJECT_ID}.supabase.co`,
      publicValue: "test-public-value",
    });
    expect(OFFICIAL_RUNTIME_ENDPOINT).toContain(MANAGED_SUPABASE_PROJECT_ID);
    expect(OFFICIAL_RUNTIME_ENDPOINT).toContain("/functions/v1/app-public-config");
  });

  it("rejects the empty managed project as the current data backend", () => {
    expect(() => validateOfficialRuntime({
      projectId: MANAGED_SUPABASE_PROJECT_ID,
      url: `https://${MANAGED_SUPABASE_PROJECT_ID}.supabase.co`,
      publishableKey: "managed-project-value",
    })).toThrow("backend de dados em produção");
  });

  it("rejects mismatched project id and URL", () => {
    expect(() => validateOfficialRuntime({
      projectId: PRODUCTION_DATA_PROJECT_ID,
      url: "https://example.supabase.co",
      publicValue: "test",
    })).toThrow("backend de dados em produção");
  });
});
