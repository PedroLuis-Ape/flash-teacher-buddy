import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913230000_public_learning_list_runtime_v1.sql"),
  "utf8",
);
const code = sql.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
const normalized = code.toLowerCase();
const raw = sql.toLowerCase();

describe("lista publica funcional em producao (P0)", () => {
  it("define as duas RPCs que a pagina usa, na assinatura esperada", () => {
    expect(normalized).toContain("create or replace function public.get_public_learning_list(_id uuid)");
    expect(normalized).toContain("create or replace function public.get_public_learning_list_card_preview(");
    expect(normalized).toContain("_limit integer default 24");
  });

  it("nao depende da camada de registro ausente em producao", () => {
    expect(code).not.toMatch(/from\s+public\.public_entity_publications/i);
    expect(code).not.toMatch(/public_entity_publications\s*\(/);
  });

  it("aplica a regra publica vigente em producao", () => {
    for (const predicate of [
      "l.visibility = 'class'",
      "l.class_id is null",
      "l.deleted_at is null",
      "f.visibility = 'class'",
      "f.class_id is null",
      "f.deleted_at is null",
      "coalesce(p.is_teacher, false) = true",
      "coalesce(p.public_access_enabled, false) = true",
      "coalesce(p.public_profile_searchable, false) = true",
      "nullif(btrim(p.public_slug), '') is not null",
    ]) {
      expect(normalized).toContain(predicate);
    }
  });

  it("protege as funcoes com search_path fixo e grants minimos", () => {
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = public, pg_temp");
    for (const fn of [
      "public.list_public_learning_list_entries(integer)",
      "public.get_public_learning_list(uuid)",
      "public.get_public_learning_list_card_preview(uuid, integer)",
    ]) {
      expect(normalized).toContain(`revoke all on function ${fn} from public;`);
      expect(normalized).toContain(`grant execute on function ${fn} to anon, authenticated;`);
    }
  });

  it("documenta backup e rollback no proprio arquivo", () => {
    expect(raw).toContain("backup de producao antes desta migration");
    expect(raw).toContain("drop function if exists public.get_public_learning_list(uuid);");
    expect(raw).toContain("drop function if exists public.get_public_learning_list_card_preview(uuid, integer);");
    expect(raw).toContain("drop function if exists public.list_public_learning_list_entries(integer);");
  });
});
