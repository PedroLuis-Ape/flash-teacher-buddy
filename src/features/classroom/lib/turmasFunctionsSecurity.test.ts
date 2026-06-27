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

function readFunction(name: (typeof FUNCTION_NAMES)[number]): string {
  return readFileSync(join(ROOT, "supabase", "functions", name, "index.ts"), "utf8");
}

function occurrences(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

describe("turma Edge Function security contracts", () => {
  const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");

  it("keeps the official project ref", () => {
    expect(config).toMatch(/^project_id\s*=\s*"xrnfhhoxmmstagmelvyi"/m);
  });

  it.each(FUNCTION_NAMES)("registers %s with JWT verification", (name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const section = new RegExp(`\\[functions\\.${escapedName}\\]([\\s\\S]*?)(?=\\n\\[|$)`);
    const match = config.match(section);
    expect(match?.[1]).toMatch(/verify_jwt\s*=\s*true/);
  });

  it.each(FUNCTION_NAMES)("requires POST, authorization and no-store in %s", (name) => {
    const source = readFunction(name);
    expect(source).toMatch(/req\.method\s*!==\s*["']POST["']/);
    expect(source).toMatch(/req\.headers\.get\(["']Authorization["']\)/);
    expect(source).toMatch(/\.auth\.getUser\(\)/);
    expect(source).toMatch(/["']Cache-Control["']\s*:\s*["']no-store["']/);
  });

  it.each(FUNCTION_NAMES)("does not use an administrative key in %s", (name) => {
    const source = readFunction(name);
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("SERVICE_ROLE_KEY");
  });

  it("restricts turma creation to teacher profiles", () => {
    const source = readFunction("turmas-create");
    expect(source).toMatch(/select\(["']is_teacher["']\)/);
    expect(source).toContain("!profile?.is_teacher");
  });

  it("validates enrollment identifiers, ownership and self-enrollment", () => {
    const source = readFunction("turmas-enroll");
    expect(source).toContain("uuidPattern");
    expect(source).toContain("apeIdPattern");
    expect(source).toContain("targetProfile.id === user.id");
    expect(source).toMatch(/\.eq\(["']ativo["'],\s*true\)/);
    expect(source).toContain("turma.owner_teacher_id !== user.id");
  });

  it("lists only active owned turmas in turmas-mine", () => {
    const source = readFunction("turmas-mine");
    expect(source).toMatch(/\.eq\(["']owner_teacher_id["'],\s*user\.id\)/);
    expect(source).toMatch(/\.eq\(["']ativo["'],\s*true\)/);
  });

  it("uses RLS instead of an administrative client in turmas-as-aluno", () => {
    const source = readFunction("turmas-as-aluno");
    expect(source).not.toContain("adminClient");
    expect(source).toMatch(/\.eq\(["']user_id["'],\s*user\.id\)/);
    expect(occurrences(source, /\.eq\(["']ativo["'],\s*true\)/g)).toBeGreaterThanOrEqual(2);
  });

  it("repeats ownership and active filters in turma update", () => {
    const source = readFunction("turmas-update");
    expect(source).toContain("uuidPattern");
    expect(source).toMatch(/\.eq\(["']owner_teacher_id["'],\s*user\.id\)/);
    expect(occurrences(source, /\.eq\(["']ativo["'],\s*true\)/g)).toBeGreaterThanOrEqual(2);
    expect(source).toContain(".maybeSingle()");
  });

  it("keeps turma deletion as a filtered soft delete", () => {
    const source = readFunction("turmas-delete");
    expect(source).toMatch(/\.update\(\{\s*ativo:\s*false\s*\}\)/);
    expect(source).toMatch(/\.eq\(["']owner_teacher_id["'],\s*user\.id\)/);
    expect(occurrences(source, /\.eq\(["']ativo["'],\s*true\)/g)).toBeGreaterThanOrEqual(2);
  });

  it("deletes only an active member from an active owned turma", () => {
    const source = readFunction("turmas-remove-member");
    expect(source).toContain("uuidPattern");
    expect(source).toContain("targetUserId === turma.owner_teacher_id");
    expect(source).toContain(".delete()");
    expect(source).not.toMatch(/\.update\(\{\s*ativo:\s*false\s*\}\)/);
    expect(source).toMatch(/\.eq\(["']user_id["'],\s*targetUserId\)/);
    expect(occurrences(source, /\.eq\(["']ativo["'],\s*true\)/g)).toBeGreaterThanOrEqual(2);
  });

  it("replaces the placeholder review with an auditable document", () => {
    const review = readFileSync(join(ROOT, "docs", "reviews", "turmas-review.md"), "utf8");
    expect(review.trim()).not.toBe("review");
    for (const name of FUNCTION_NAMES) expect(review).toContain(`\`${name}\``);
  });

  it("keeps the static audit document readable and linked to all turma functions", () => {
    const audit = readFileSync(join(ROOT, "docs", "security-static-audit.md"), "utf8");
    expect(audit).not.toContain("\uFFFD");
    expect(audit).not.toContain("verificåvel");
    expect(audit).not.toContain("traté-las");
    for (const name of FUNCTION_NAMES) expect(audit).toContain(`\`${name}\``);
  });
});
