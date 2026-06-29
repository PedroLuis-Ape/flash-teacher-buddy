import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
const runtimeSource = readFileSync(
  join(process.cwd(), "src", "integrations", "supabase", "platformRuntime.ts"),
  "utf8",
);

describe("application bootstrap", () => {
  it("keeps App behind the guarded dynamic import", () => {
    const mountFunction = mainSource.indexOf("async function mountApplication");
    const guardedImport = mainSource.indexOf('await import("./App.tsx")', mountFunction);
    const errorHandler = mainSource.indexOf("renderBootstrapFailure(error)", guardedImport);

    expect(mainSource).not.toContain('import App from "./App.tsx"');
    expect(mountFunction).toBeGreaterThanOrEqual(0);
    expect(guardedImport).toBeGreaterThan(mountFunction);
    expect(errorHandler).toBeGreaterThan(guardedImport);
  });

  it("keeps a non-throwing runtime fallback during rollback", () => {
    expect(runtimeSource).toContain("FALLBACK_RUNTIME");
    expect(runtimeSource).toContain("return { ...FALLBACK_RUNTIME }");
    expect(runtimeSource).not.toContain("A configuração oficial do Supabase não foi carregada antes");
  });
});
