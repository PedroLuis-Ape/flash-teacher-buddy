import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const FUNCTION_NAMES = [
  "turmas-create",
  "turmas-enroll",
  "turmas-mine",
  "turmas-as-aluno",
  "turmas-update",
  "turmas-delete",
  "turmas-remove-member",
] as const;

const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");

describe("turma function configuration", () => {
  it("declares a valid platform project reference", () => {
    expect(config).toMatch(/^project_id\s*=\s*"[a-z]{20}"/m);
  });

  it.each(FUNCTION_NAMES)("requires token verification for %s", (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const section = config.match(
      new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
    );
    expect(section?.[1]).toMatch(/verify_jwt\s*=\s*true/);
  });
});
