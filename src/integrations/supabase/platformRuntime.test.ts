import { describe, expect, it } from "vitest";
import { resolvePlatformRuntime } from "./platformRuntime";

describe("platform runtime", () => {
  it("uses the complete Lovable-injected configuration as the source of truth", () => {
    expect(
      resolvePlatformRuntime({
        projectId: "abcdefghijklmnopqrst",
        url: "https://abcdefghijklmnopqrst.supabase.co",
        publicValue: "current-publishable-value",
      }),
    ).toEqual({
      projectId: "abcdefghijklmnopqrst",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publicValue: "current-publishable-value",
    });
  });

  it("does not replace a current injected key with a bundled legacy key", () => {
    const runtime = resolvePlatformRuntime({
      projectId: "ymahldldyxvwjeruaxpr",
      url: "https://ymahldldyxvwjeruaxpr.supabase.co",
      publicValue: "fresh-current-key",
    });

    expect(runtime.publicValue).toBe("fresh-current-key");
  });

  it("uses one coherent fallback when the injected configuration is absent or partial", () => {
    for (const input of [{}, { url: "https://other.supabase.co" }]) {
      const runtime = resolvePlatformRuntime(input);
      expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
      expect(runtime.url).toBe("https://ymahldldyxvwjeruaxpr.supabase.co");
      expect(runtime.publicValue).toMatch(/^eyJ/);
    }
  });

  it("keeps tests isolated from production", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
