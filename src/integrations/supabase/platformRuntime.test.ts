import { describe, expect, it } from "vitest";
import { resolvePlatformRuntime } from "./platformRuntime";

describe("platform runtime resolution", () => {
  it("prefers a complete configuration injected by the platform", () => {
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

  it("does not mix a partial injected configuration with another backend", () => {
    const runtime = resolvePlatformRuntime({
      url: "https://abcdefghijklmnopqrst.supabase.co",
    });

    expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
    expect(runtime.url).toBe("https://ymahldldyxvwjeruaxpr.supabase.co");
    expect(runtime.publicValue).toBeTruthy();
  });

  it("recovers the canonical Lovable Cloud configuration when build variables are absent", () => {
    const runtime = resolvePlatformRuntime({});

    expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
    expect(runtime.url).toBe("https://ymahldldyxvwjeruaxpr.supabase.co");
    expect(runtime.publicValue).toMatch(/^eyJ/);
  });

  it("keeps tests isolated from the production backend", () => {
    expect(resolvePlatformRuntime({}, true)).toEqual({
      projectId: "test-project",
      url: "https://example.supabase.co",
      publicValue: "test-public-value",
    });
  });
});
