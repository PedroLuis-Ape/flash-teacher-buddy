import { describe, expect, it } from "vitest";
import { OFFICIAL_SUPABASE_PROJECT_ID, OFFICIAL_SUPABASE_URL, resolvePlatformRuntime } from "./platformRuntime";

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

  it("rejects a different project", () => {
    expect(() => resolvePlatformRuntime({
      projectId: "another-project",
      url: "https://another-project.supabase.co",
      publicValue: "test-value",
    })).toThrow("projeto Supabase diferente");
  });

  it("fails closed when configuration is absent", () => {
    expect(() => resolvePlatformRuntime({})).toThrow("configuração oficial");
  });

  it("keeps tests isolated", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
