import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const locales = ["pt-BR", "en", "es", "fr", "it"];

describe("pagina canonica de material publico", () => {
  it("existe rota parametrizada por locale e slug", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/:locale/material/:slug"');
    expect(app).toContain("PublicResourcePage");
  });

  it("os cinco locales sao rotas publicas", () => {
    const access = read("src/lib/sessionRouteAccess.ts");
    for (const locale of locales) {
      // A URL publica usa o codigo em minusculas (pt-br), o registro i18n usa pt-BR.
      expect(access).toContain(`'/${locale.toLowerCase()}/material'`);
    }
  });

  it("so renderiza material aprovado e nunca inventa conteudo", () => {
    const page = read("src/features/public-materials/PublicResourcePage.tsx");
    expect(page).toContain('data?.source === "editorial"');
    expect(page).toContain("canonicalPath={null}");
    // Sem material aprovado a pagina diz que nao esta disponivel, sem citar
    // nomes ou numeros de material algum.
    expect(page).not.toMatch(/Passo 00|Verbo to be|Everyday Collocations/);
  });

  it("le a curadoria pela RPC publica", () => {
    const hook = read("src/features/public-materials/usePublicResource.ts");
    expect(hook).toContain('"get_public_resource_v1"');
    expect(hook).toContain("publicSupabase");
  });

  it("todas as locales tem as chaves da pagina", () => {
    for (const locale of locales) {
      const json = JSON.parse(read(`src/i18n/resources/${locale}/home.json`));
      expect(json.publicResource.notFoundTitle.length).toBeGreaterThan(5);
      expect(json.publicResource.playNow.length).toBeGreaterThan(3);
      expect(json.publicResource.guestNote.length).toBeGreaterThan(10);
    }
  });
});
