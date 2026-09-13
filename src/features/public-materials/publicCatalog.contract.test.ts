import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/sessionRouteAccess";

const url = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => existsSync(url(path)) ? readFileSync(url(path), "utf8") : "";
const locales = ["pt-BR", "en", "es", "fr", "it"];

describe("catalogo publico com busca e filtros", () => {
  it("registra a rota localizada e a mantem publica durante a hidratacao", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/:locale/materiais"');
    expect(app).toContain("PublicCatalogPage");

    for (const locale of locales) {
      expect(isProtectedPath(`/${locale.toLowerCase()}/materiais`)).toBe(false);
    }
  });

  it("mapeia a URL para a RPC publica e isola o cache por todos os argumentos", () => {
    const hook = read("src/features/public-materials/usePublicResourceCatalog.ts");
    expect(hook).toContain('"list_public_resources_v1"');
    expect(hook).toContain("publicSupabase.rpc.bind(publicSupabase)");
    expect(hook).toContain("_locale: locale");
    expect(hook).toContain("_q: q || null");
    expect(hook).toContain("_level: level || null");
    expect(hook).toContain("_theme: theme || null");
    expect(hook).toContain("_resource_type: type || null");
    expect(hook).toContain("_limit: limit");
    expect(hook).toContain("_offset: offset");
    expect(hook).toContain('["public", "catalog", locale, q, level, theme, type, limit, offset]');
    expect(hook).toContain("staleTime: 5 * 60 * 1000");
  });

  it("oferece busca acessivel, debounce e filtros progressivos no mobile", () => {
    const page = read("src/features/public-materials/PublicCatalogPage.tsx");
    expect(page).toContain('htmlFor="public-catalog-search"');
    expect(page).toContain('id="public-catalog-search"');
    expect(page).toContain("useSearchParams");
    expect(page).toContain("SEARCH_DEBOUNCE_MS = 350");
    expect(page).toContain("replace: true");
    expect(page).toContain("Collapsible");
    expect(page).toContain('t("publicCatalog.filterToggle")');
  });

  it("distingue ausencia de curadoria, zero por filtros e erro recuperavel", () => {
    const page = read("src/features/public-materials/PublicCatalogPage.tsx");
    expect(page).toContain('t("publicCatalog.emptyCurationTitle")');
    expect(page).toContain('t("publicCatalog.emptyFilteredTitle")');
    expect(page).toContain('t("publicCatalog.errorTitle")');
    expect(page).toContain('t("publicCatalog.retry")');
    expect(page).toContain("refetch()");
    expect(page).toContain('t("publicCatalog.clearFilters")');
  });

  it("usa somente os caminhos devolvidos pelo servidor para jogar e abrir o canonical do material", () => {
    const page = read("src/features/public-materials/PublicCatalogPage.tsx");
    expect(page).toContain("to={item.play_path}");
    expect(page).toContain("to={item.canonical_path}");
    expect(page).not.toMatch(/portal\/list\/\$\{|material\/\$\{item\./);
  });

  it("indexa so a base e canoniza qualquer busca ou filtro para ela", () => {
    const page = read("src/features/public-materials/PublicCatalogPage.tsx");
    expect(page).toContain('robots={hasUrlFilters ? "noindex, follow" : undefined}');
    expect(page).toContain("canonicalPath={basePath}");
  });

  it("mantem as chaves do catalogo completas nos cinco locales", () => {
    for (const locale of locales) {
      const json = JSON.parse(read(`src/i18n/resources/${locale}/home.json`));
      expect(json.publicCatalog).toBeDefined();
      expect(json.publicCatalog.searchLabel.length).toBeGreaterThan(3);
      expect(json.publicCatalog.emptyCurationBody.length).toBeGreaterThan(10);
      expect(json.publicCatalog.emptyFilteredBody.length).toBeGreaterThan(10);
      expect(json.publicCatalog.retry.length).toBeGreaterThan(3);
      expect(json.publicCatalog.playNow.length).toBeGreaterThan(8);
    }
  });
});
