import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const STRICT_FUNCTIONS = [
  "turmas-create",
  "turmas-enroll",
  "turmas-update",
  "turmas-delete",
  "turmas-remove-member",
] as const;
const GUARDED_GATEWAY_EXCEPTIONS = ["turmas-mine", "turmas-as-aluno"] as const;

const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");
const policy = JSON.parse(readFileSync(join(ROOT, "config", "security-audit.json"), "utf8"));

function configSection(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return config.match(new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] ?? "";
}

describe("turma function configuration", () => {
  it("declares the official platform project reference", () => {
    expect(config).toContain('project_id = "xrnfhhoxmmstagmelvyi"');
  });

  it.each(STRICT_FUNCTIONS)("requires gateway token verification for %s", (name) => {
    expect(configSection(name)).toMatch(/verify_jwt\s*=\s*true/);
  });

  it.each(GUARDED_GATEWAY_EXCEPTIONS)("documents and validates the guarded exception for %s", (name) => {
    expect(configSection(name)).toMatch(/verify_jwt\s*=\s*false/);
    expect(policy.gatewayJwtExceptions?.[name]).toEqual(expect.any(String));
    const source = readFileSync(join(ROOT, "supabase", "functions", name, "index.ts"), "utf8");
    expect(source).toContain("auth.getUser");
  });
});
