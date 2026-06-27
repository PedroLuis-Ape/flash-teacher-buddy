import { describe, expect, it } from "vitest";
import { resolvePlatformRuntime } from "./platformRuntime";

const productionUrl = "https://ymahldldyxvwjeruaxpr.supabase.co";

describe("platform runtime", () => {
  it("locks production to the backend that contains the real App Piteco data", () => {
    const runtime = resolvePlatformRuntime({
      projectId: "xrnfhhoxmmstagmelvyi",
      url: "https://xrnfhhoxmmstagmelvyi.supabase.co",
      publicValue: "wrong-project-public-value",
    });

    expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
    expect(runtime.url).toBe(productionUrl);
    expect(runtime.publicValue).toMatch(/^eyJ/);
  });

  it("keeps the complete official production set atomic", () => {
    const runtime = resolvePlatformRuntime({
      projectId: "ymahldldyxvwjeruaxpr",
      url: productionUrl,
      publicValue: "stale-or-mismatched-injected-value",
    });

    expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
    expect(runtime.url).toBe(productionUrl);
    expect(runtime.publicValue).toMatch(/^eyJ/);
    expect(runtime.publicValue).not.toBe("stale-or-mismatched-injected-value");
  });

  it("allows an explicit non-production override only during development", () => {
    expect(
      resolvePlatformRuntime(
        {
          projectId: "abcdefghijklmnopqrst",
          url: "https://abcdefghijklmnopqrst.supabase.co",
          publicValue: "development-public-value",
        },
        false,
        true,
      ),
    ).toEqual({
      projectId: "abcdefghijklmnopqrst",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publicValue: "development-public-value",
    });
  });

  it("uses the production runtime when build configuration is absent or partial", () => {
    for (const input of [{}, { url: "https://other.supabase.co" }]) {
      const runtime = resolvePlatformRuntime(input);
      expect(runtime.projectId).toBe("ymahldldyxvwjeruaxpr");
      expect(runtime.url).toBe(productionUrl);
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
