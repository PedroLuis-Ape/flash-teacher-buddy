import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
const runtimeSource = readFileSync(
  join(process.cwd(), "src", "integrations", "supabase", "platformRuntime.ts"),
  "utf8",
);
const bootstrapSource = readFileSync(
  join(process.cwd(), "src", "integrations", "supabase", "runtimeBootstrap.ts"),
  "utf8",
);

describe("Lovable Cloud bootstrap", () => {
  it("loads the official Supabase runtime before importing App", () => {
    const mountFunction = mainSource.indexOf("async function mountApplication");
    const loadRuntime = mainSource.indexOf("await loadOfficialPlatformRuntime()", mountFunction);
    const installRuntime = mainSource.indexOf("installPlatformRuntime(runtime)", loadRuntime);
    const guardedImport = mainSource.indexOf('await import("./App.tsx")', installRuntime);
    const errorHandler = mainSource.indexOf("renderBootstrapFailure(error)", guardedImport);

    expect(mainSource).not.toContain('import App from "./App.tsx"');
    expect(mountFunction).toBeGreaterThanOrEqual(0);
    expect(loadRuntime).toBeGreaterThan(mountFunction);
    expect(installRuntime).toBeGreaterThan(loadRuntime);
    expect(guardedImport).toBeGreaterThan(installRuntime);
    expect(errorHandler).toBeGreaterThan(guardedImport);
  });

  it("forces the splash to finish after the maximum startup time", () => {
    const maxTimer = mainSource.indexOf("SPLASH_MAX_MS");
    const forceReady = mainSource.indexOf("appReady = true", maxTimer);
    const forceMinimum = mainSource.indexOf("minTimePassed = true", forceReady);
    const dismiss = mainSource.indexOf("finishAndHide()", forceMinimum);

    expect(maxTimer).toBeGreaterThanOrEqual(0);
    expect(forceReady).toBeGreaterThan(maxTimer);
    expect(forceMinimum).toBeGreaterThan(forceReady);
    expect(dismiss).toBeGreaterThan(forceMinimum);
    expect(mainSource).toContain("__apeBootComplete");
  });

  it("never falls back silently to the retired Supabase project", () => {
    expect(bootstrapSource).toContain('OFFICIAL_SUPABASE_PROJECT_ID = "xrnfhhoxmmstagmelvyi"');
    expect(bootstrapSource).toContain("/functions/v1/app-public-config");
    expect(runtimeSource).toContain("__APE_PLATFORM_RUNTIME__");
    expect(runtimeSource).not.toContain("ymahldldyxvwjeruaxpr");
    expect(mainSource).not.toContain("ymahldldyxvwjeruaxpr");
  });
});
