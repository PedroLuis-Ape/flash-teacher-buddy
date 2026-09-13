import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20260913140000_public_resource_editorial_v1.sql", import.meta.url),
  "utf8",
);

describe("curadoria editorial de materiais publicos (Fase 4)", () => {
  it("cria a tabela de curadoria com estados e deny-all", () => {
    expect(sql).toContain("create table if not exists public.public_resource_editorial");
    expect(sql).toContain("check (status in ('draft', 'approved', 'retired'))");
    expect(sql).toContain("alter table public.public_resource_editorial enable row level security;");
    expect(sql).toContain(
      "revoke all on table public.public_resource_editorial from public, anon, authenticated;",
    );
    expect(sql).toContain("unique (locale, slug)");
  });

  it("le apenas o que foi aprovado explicitamente", () => {
    const aprovado = sql.match(/e\.status = 'approved'/g) ?? [];
    const indexavel = sql.match(/e\.is_indexable/g) ?? [];
    expect(aprovado.length).toBeGreaterThanOrEqual(2);
    expect(indexavel.length).toBeGreaterThanOrEqual(2);
  });

  it("aplica o quality gate no servidor", () => {
    expect(sql).toContain("v_row.card_count < 8 or v_row.unique_terms < ceil(v_row.card_count * 0.9)");
    expect(sql).toContain("'reason', 'QUALITY_GATE'");
  });

  it("reusa a regra publica vigente do portal", () => {
    expect(sql).toContain("f.visibility = 'class'");
    expect(sql).toContain("f.class_id is null");
    expect(sql).toContain("coalesce(p.public_access_enabled, false)");
    // Nao depende do registro de publicacoes ausente em producao (o nome so
    // aparece no comentario que documenta a decisao).
    expect(sql).not.toMatch(/(from|join)\s+public\.public_entity_publications/i);
  });

  it("expoe as leituras publicas com grants explicitos", () => {
    expect(sql).toContain("grant execute on function public.get_public_resource_v1(text, text) to anon, authenticated, service_role;");
    expect(sql).toContain("grant execute on function public.list_public_resources_v1(text, integer, integer) to anon, authenticated, service_role;");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("semeia curadoria apenas como rascunho nao indexavel", () => {
    const seeds = sql.split("values")[1] ?? "";
    expect(seeds).not.toContain("'approved'");
    const drafts = seeds.match(/'draft', false/g) ?? [];
    expect(drafts.length).toBeGreaterThanOrEqual(5);
  });
});
