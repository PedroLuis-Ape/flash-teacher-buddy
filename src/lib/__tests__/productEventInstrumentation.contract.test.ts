import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const SURFACES = {
  featured: "src/features/public-home/FeaturedPublicResource.tsx",
  carousel: "src/features/public-home/MarketingCarousel.tsx",
  material: "src/features/public-materials/PublicResourcePage.tsx",
  catalog: "src/features/public-materials/PublicCatalogPage.tsx",
  mergePrompt: "src/features/guest/GuestStateMergePrompt.tsx",
  invite: "src/features/guest/GuestAccountInvite.tsx",
} as const;

describe("instrumentacao de eventos nas superficies", () => {
  it("mede impressao e clique do destaque da Home", () => {
    const source = read(SURFACES.featured);
    expect(source).toContain("featured_resource_impression");
    expect(source).toContain("featured_resource_play");
    expect(source).toContain("trackProductEventOnce");
  });

  it("mede visualizacao e interacao do carrossel", () => {
    const source = read(SURFACES.carousel);
    expect(source).toContain("carousel_slide_view");
    expect(source).toContain("carousel_interaction");
  });

  it("mede a visualizacao do material canonico", () => {
    const source = read(SURFACES.material);
    expect(source).toContain("public_resource_view");
    expect(source).toContain("resource-view:");
  });

  it("mede busca do catalogo sem enviar o termo digitado", () => {
    const source = read(SURFACES.catalog);
    expect(source).toContain("public_search_used");
    expect(source).toContain("result_count: data.total");
    expect(source).not.toMatch(/trackProductEvent\(\s*"public_search_used"[\s\S]{0,120}?\bq\b/);
  });

  it("mede o fluxo visitante para conta", () => {
    const prompt = read(SURFACES.mergePrompt);
    expect(prompt).toContain("guest_resume");
    expect(prompt).toContain("signup_sync_cta_view");
    expect(prompt).toContain("signup_after_guest");
    expect(read(SURFACES.invite)).toContain("signup_sync_cta_view");
  });

  it("nao envia identificador de usuario como payload", () => {
    const source = Object.values(SURFACES).map(read).join("\n");
    expect(source).not.toMatch(/trackProductEvent\([^)]*userId/);
  });

  it("mede inicio e conclusao de jogo no fluxo visitante", () => {
    for (const page of ["src/pages/Study.tsx", "src/pages/MixedStudy.tsx"]) {
      const source = read(page);
      expect(source).toContain("guest_game_start");
      expect(source).toContain("guest_game_complete");
      expect(source).toMatch(/if \(\w*[uU]serId \|\| !resolvedId\) return;/);
    }
  });
});
