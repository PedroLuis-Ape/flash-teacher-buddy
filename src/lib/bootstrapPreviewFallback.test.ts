import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
const runtimeSource = readFileSync(join(process.cwd(), "src", "integrations", "supabase", "platformRuntime.ts"), "utf8");
const bootstrapSource = readFileSync(join(process.cwd(), "src", "integrations", "supabase", "runtimeBootstrap.ts"), "utf8");

describe("application bootstrap", () => {
  it("keeps App behind the guarded dynamic import", () => {
    const mountFunction = mainSource.indexOf("async function mountApplication");
    const runtimeInstall = mainSource.indexOf("installPlatformRuntime(await loadOfficialPlatformRuntime())", mountFunction);
    const guardedImport = mainSource.indexOf('await import("./App.tsx")', mountFunction);
    const errorHandler = mainSource.indexOf("renderBootstrapFailure(error)", guardedImport);
    expect(mainSource).not.toContain('import App from "./App.tsx"');
    expect(mountFunction).toBeGreaterThanOrEqual(0);
    expect(runtimeInstall).toBeGreaterThan(mountFunction);
    expect(guardedImport).toBeGreaterThan(runtimeInstall);
    expect(errorHandler).toBeGreaterThan(guardedImport);
  });

  it("accepts only the official Supabase project and has no foreign fallback", () => {
    expect(runtimeSource).toContain("OFFICIAL_SUPABASE_PROJECT_ID");
    expect(runtimeSource).toContain("xrnfhhoxmmstagmelvyi");
    expect(runtimeSource).toContain("assertOfficialPlatformRuntime");
    expect(runtimeSource).not.toContain("PRODUCTION_DATA_PROJECT_ID");
    expect(runtimeSource).not.toContain("PRODUCTION_DATA_PUBLIC_VALUE");
    expect(bootstrapSource).toContain("OFFICIAL_RUNTIME_ENDPOINT");
    expect(bootstrapSource).toContain("app-public-config");
    expect(bootstrapSource).toContain("A configuração não aponta para o projeto Supabase oficial");
  });
});
