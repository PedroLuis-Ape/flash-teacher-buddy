import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20260913180000_public_resource_catalog_v1.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("catalogo publico curado (Fase 4)", () => {
  it("substitui a sobrecarga antiga pela assinatura de busca com sete parametros", () => {
    expect(sql).toContain(
      "drop function if exists public.list_public_resources_v1(text, integer, integer);",
    );
    expect(sql).toMatch(
      /create or replace function public\.list_public_resources_v1\(\s*_locale text default 'pt-br',\s*_q text default null,\s*_level text default null,\s*_theme text default null,\s*_resource_type text default null,\s*_limit integer default 50,\s*_offset integer default 0\s*\)/,
    );
  });

  it("mantem a RPC publica protegida por security definer, search path e grants explicitos", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain(
      "revoke all on function public.list_public_resources_v1(text, text, text, text, text, integer, integer) from public, anon, authenticated, service_role;",
    );
    expect(sql).toContain(
      "grant execute on function public.list_public_resources_v1(text, text, text, text, text, integer, integer) to anon, authenticated, service_role;",
    );
  });

  it("preserva um quality gate unico, aplicado antes de itens e facetas", () => {
    const cardCountGate = sql.match(/card_count\s*>=\s*8/g) ?? [];
    const uniqueTermsGate = sql.match(/unique_terms\s*>=\s*ceil\(card_count\s*\*\s*0\.9\)/g) ?? [];

    expect(cardCountGate).toHaveLength(1);
    expect(uniqueTermsGate).toHaveLength(1);
    expect(sql).toContain("eligible as");
    expect(sql).toContain("from eligible");
  });

  it("inclui filtros, total, has_more e facetas sem colapsar os filtros", () => {
    expect(sql).toContain("title ilike '%' || nullif(btrim(_q), '') || '%'");
    expect(sql).toContain("summary ilike '%' || nullif(btrim(_q), '') || '%'");
    expect(sql).toContain("theme ilike '%' || nullif(btrim(_q), '') || '%'");
    expect(sql).toContain("lower(level) = lower(nullif(btrim(_level), ''))");
    expect(sql).toContain("lower(theme) = lower(nullif(btrim(_theme), ''))");
    expect(sql).toContain("lower(resource_type) = lower(nullif(btrim(_resource_type), ''))");
    expect(sql).toContain("total as (select count(*)::integer as count from filtered)");
    expect(sql).toContain("jsonb_array_length(items.items)) < total.count");
    expect(sql).toContain("facets as (");
  });

  it("documenta um rollback executavel", () => {
    expect(sql).toContain("rollback (executavel):");
    expect(sql).toContain(
      "drop function if exists public.list_public_resources_v1(text, text, text, text, text, integer, integer);",
    );
    expect(sql).toContain(
      "create or replace function public.list_public_resources_v1(_locale text default 'pt-br', _limit integer default 50, _offset integer default 0)",
    );
  });
});
