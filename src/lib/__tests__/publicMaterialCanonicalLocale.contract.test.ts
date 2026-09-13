import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/sessionRouteAccess";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical dos materiais publicos", () => {
  it("trata material publico como rota publica mesmo com locale em maiuscula", () => {
    expect(isProtectedPath("/pt-br/material/exemplo-a1")).toBe(false);
    expect(isProtectedPath("/pt-BR/material/exemplo-a1")).toBe(false);
    expect(isProtectedPath("/pt-br/materiais")).toBe(false);
    expect(isProtectedPath("/pt-BR/materiais")).toBe(false);
    expect(isProtectedPath("/dashboard")).toBe(true);
  });

  it("os RPCs montam canonical_path em minusculo", () => {
    // Causa-raiz do bug: o banco guarda o code do locale (pt-BR) e concatenava
    // direto na URL, enquanto rota, gate e prerender usam o segmento minusculo.
    const catalog = read("supabase/migrations/20260913210000_public_resource_canonical_lowercase_v1.sql");
    expect(catalog).toContain("'/' || lower(v_row.locale) || '/material/' || v_row.slug");
    expect(catalog).toContain("'/' || lower(page.locale) || '/material/' || page.slug");
    expect(catalog).not.toContain("'/' || v_row.locale || '/material/'");
    expect(catalog).not.toContain("'/' || page.locale || '/material/'");
  });

  it("o prerender usa o segmento minusculo do locale", () => {
    const data = read("scripts/public-material-data.mjs");
    expect(data).toContain("export function publicCatalogPath");
    expect(data).toMatch(/URL_SEGMENT/);
  });
});
