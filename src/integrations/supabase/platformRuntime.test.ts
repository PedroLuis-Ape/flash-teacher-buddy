import { describe, expect, it } from "vitest";
import { resolvePlatformRuntime } from "./platformRuntime";

describe("platform runtime", () => {
  it("uses a complete Lovable-injected configuration when available", () => {
    expect(
      resolvePlatformRuntime({
        projectId: "abcdefghijklmnopqrst",
        url: "https://abcdefghijklmnopqrst.supabase.co",
        publicValue: "injected-public-value",
      }),
    ).toEqual({
      projectId: "abcdefghijklmnopqrst",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publicValue: "injected-public-value",
    });
  });

  it("atomically replaces a missing configuration with the production runtime", () => {
    const runtime = resolvePlatformRuntime({});

    expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
    expect(runtime.url).toBe("https://ymahldldyxvwjeruaxpr.supabase.co");
    expect(runtime.publicValue).toMatch(/^eyJ/);
  });

  it("does not mix a partial injected backend with the production backend", () => {
    const runtime = resolvePlatformRuntime({
      url: "https://abcdefghijklmnopqrst.supabase.co",
    });

    expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
    expect(runtime.url).toBe("https://ymahldldyxvwjeruaxpr.supabase.co");
  });

  it("keeps tests isolated from production", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
