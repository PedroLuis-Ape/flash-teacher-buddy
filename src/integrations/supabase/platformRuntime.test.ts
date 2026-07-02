import { describe, expect, it } from "vitest";
import {
  PRODUCTION_DATA_PROJECT_ID,
  PRODUCTION_DATA_RUNTIME,
  PRODUCTION_DATA_URL,
  resolvePlatformRuntime,
} from "./platformRuntime";

const production = {
  projectId: PRODUCTION_DATA_PROJECT_ID,
  url: PRODUCTION_DATA_URL,
  publicValue: "test-value",
};

describe("platform runtime", () => {
  it("uses an injected production data configuration", () => {
    expect(resolvePlatformRuntime(production)).toEqual(production);
  });

  it("prefers an installed production data runtime", () => {
    expect(resolvePlatformRuntime(production, false, { ...production, publicValue: "installed-value" }).publicValue).toBe("installed-value");
  });

  it("ignores the empty managed project and keeps the production data backend", () => {
    expect(resolvePlatformRuntime({
      projectId: "xrnfhhoxmmstagmelvyi",
      url: "https://xrnfhhoxmmstagmelvyi.supabase.co",
      publicValue: "managed-project-value",
    })).toEqual(PRODUCTION_DATA_RUNTIME);
  });

  it("uses the production data runtime when configuration is absent", () => {
    expect(resolvePlatformRuntime({})).toEqual(PRODUCTION_DATA_RUNTIME);
  });

  it("keeps tests isolated", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
