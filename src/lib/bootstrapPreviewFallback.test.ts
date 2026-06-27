import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
const runtimeSource = readFileSync(
  join(process.cwd(), "src", "integrations", "supabase", "platformRuntime.ts"),
  "utf8",
);

describe("Lovable Cloud bootstrap", () => {
  it("loads the application directly without fetching an external runtime", () => {
    expect(mainSource).toContain('import App from "./App.tsx"');
    expect(mainSource).not.toContain("resolveRuntimeConfig");
    expect(mainSource).not.toContain("installPlatformRuntime");
    expect(mainSource).not.toContain("app-public-config");
  });

  it("uses statically analyzable Vite variables supplied by Lovable", () => {
    expect(runtimeSource).toContain("import.meta.env.VITE_SUPABASE_URL");
    expect(runtimeSource).toContain("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(runtimeSource).not.toContain('const prefix = ["VITE", "SUPABASE"]');
    expect(runtimeSource).not.toContain("xrnfhhoxmmstagmelvyi");
  });
});
