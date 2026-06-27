import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");

describe("preview bootstrap fallback", () => {
  it("loads and installs runtime configuration before importing the app", () => {
    const resolver = source.indexOf("async function resolveRuntimeConfig");
    const remoteLoad = source.indexOf("await fetchRuntimeConfig()", resolver);
    const runtimeInstall = source.indexOf("installPlatformRuntime(runtime)");
    const appImport = source.indexOf('await import("./App.tsx")');

    expect(resolver).toBeGreaterThanOrEqual(0);
    expect(remoteLoad).toBeGreaterThan(resolver);
    expect(runtimeInstall).toBeGreaterThan(remoteLoad);
    expect(appImport).toBeGreaterThan(runtimeInstall);
    expect(source).toContain("readCachedRuntime()");
    expect(source).toContain("readEnvironmentRuntime()");
  });

  it("checks preview context before recovery cleanup", () => {
    const recovery = source.indexOf("async function attemptAutomaticRecovery");
    const previewGuard = source.indexOf("if (isPreviewContext())", recovery);
    const cleanup = source.indexOf("getRegistrations()", recovery);

    expect(recovery).toBeGreaterThanOrEqual(0);
    expect(previewGuard).toBeGreaterThan(recovery);
    expect(cleanup).toBeGreaterThan(previewGuard);
  });
});
