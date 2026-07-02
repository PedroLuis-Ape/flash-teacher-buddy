import { describe, expect, it } from "vitest";
import {
  OFFICIAL_RUNTIME,
  OFFICIAL_SUPABASE_PROJECT_ID,
  OFFICIAL_SUPABASE_URL,
  resolvePlatformRuntime,
} from "./platformRuntime";

const official = {
  projectId: OFFICIAL_SUPABASE_PROJECT_ID,
  url: OFFICIAL_SUPABASE_URL,
  publicValue: "test-value",
};

describe("platform runtime", () => {
  it("uses the official injected configuration", () => {
    expect(resolvePlatformRuntime(official)).toEqual(official);
  });

  it("prefers an installed official runtime", () => {
    expect(resolvePlatformRuntime(official, false, { ...official, publicValue: "installed-value" }).publicValue).toBe("installed-value");
  });

  it("ignores a stale project and falls back to the bundled official runtime", () => {
    expect(resolvePlatformRuntime({
      projectId: "another-project",
      url: "https://another-project.supabase.co",
      publicValue: "stale-value",
    })).toEqual(OFFICIAL_RUNTIME);
  });

  it("uses the official runtime when configuration is absent", () => {
    expect(resolvePlatformRuntime({})).toEqual(OFFICIAL_RUNTIME);
  });

  it("keeps tests isolated", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
