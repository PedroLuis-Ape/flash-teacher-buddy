import { describe, expect, it } from "vitest";
import {
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
  it("uses an injected official configuration", () => {
    expect(resolvePlatformRuntime(official)).toEqual(official);
  });

  it("prefers an installed official runtime", () => {
    expect(resolvePlatformRuntime(official, false, { ...official, publicValue: "installed-value" }).publicValue).toBe("installed-value");
  });

  it("rejects configurations from another project", () => {
    expect(() => resolvePlatformRuntime({
      projectId: "abcdefghijklmnopqrst",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publicValue: "wrong-project-value",
    })).toThrow("ainda não foi instalada");
  });

  it("fails clearly when public configuration is absent", () => {
    expect(() => resolvePlatformRuntime({})).toThrow("ainda não foi instalada");
  });

  it("keeps tests isolated", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
