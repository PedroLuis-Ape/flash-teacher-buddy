import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
const runtimeSource = readFileSync(
  join(process.cwd(), "src", "integrations", "supabase", "platformRuntime.ts"),
  "utf8",
);

describe("Lovable Cloud bootstrap", () => {
  it("loads App inside a guarded dynamic import", () => {
    const mountFunction = mainSource.indexOf("async function mountApplication");
    const guardedImport = mainSource.indexOf('await import("./App.tsx")', mountFunction);
    const errorHandler = mainSource.indexOf("renderBootstrapFailure(error)", guardedImport);

    expect(mainSource).not.toContain('import App from "./App.tsx"');
    expect(mountFunction).toBeGreaterThanOrEqual(0);
    expect(guardedImport).toBeGreaterThan(mountFunction);
    expect(errorHandler).toBeGreaterThan(guardedImport);
    expect(mainSource).not.toContain("resolveRuntimeConfig");
    expect(mainSource).not.toContain("installPlatformRuntime");
    expect(mainSource).not.toContain("app-public-config");
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

  it("uses statically analyzable Vite variables supplied by Lovable", () => {
    expect(runtimeSource).toContain("import.meta.env.VITE_SUPABASE_URL");
    expect(runtimeSource).toContain("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(runtimeSource).not.toContain('const prefix = ["VITE", "SUPABASE"]');
    expect(runtimeSource).not.toContain("xrnfhhoxmmstagmelvyi");
  });
});
