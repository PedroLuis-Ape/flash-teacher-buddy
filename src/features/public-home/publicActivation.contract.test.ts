import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const featured = read("src/features/public-home/FeaturedPublicResource.tsx");
const hook = read("src/features/public-home/useFeaturedPublicResource.ts");
const carousel = read("src/features/public-home/MarketingCarousel.tsx");
const shots = read("src/features/public-home/marketingScreenshots.ts");
const landing = read("src/components/landing/LandingHome.tsx");
const migration = read("supabase/migrations/20260913120000_featured_public_resource_v1.sql");
const locales = ["pt-BR", "en", "es", "fr", "it"];

describe("Home publica de ativacao", () => {
  it("nunca inventa atividade quando a RPC responde source none", () => {
    expect(featured).toContain('data.source === "none"');
    expect(featured).toContain("if (!data || data.source === \"none\" || !data.list) return null;");
    expect(featured).toContain('if (isError) return null;');
  });

  it("le o destaque do banco pela RPC publica e nao de dado fixo no cliente", () => {
    expect(hook).toContain('get_featured_public_resource_v1');
    expect(hook).toContain("publicSupabase");
    expect(featured).not.toMatch(/Passo 00/);
    expect(featured).not.toMatch(/a1c6d475/);
  });

  it("mantem os tres niveis de CTA e a microcopy de confianca", () => {
    expect(landing).toContain('data-cta="primary-play"');
    expect(landing).toContain('data-cta="secondary-explore"');
    expect(landing).toContain('data-cta="tertiary-teacher"');
    expect(landing).toContain('t("publicLanding.localProgressNote")');
  });

  it("usa o play_path do servidor como destino do CTA principal", () => {
    expect(landing).toContain("featured?.play_path ?? \"/portal\"");
    expect(featured).toContain("data.play_path ?? FALLBACK_PLAY_HREF");
  });

  it("carrossel tem capturas reais, dimensoes e texto em HTML", () => {
    expect(shots).toContain("/marketing/screenshots/");
    expect((shots.match(/file: "\/marketing\/screenshots\//g) ?? []).length).toBe(4);
    expect(carousel).toContain("width={shot.width}");
    expect(carousel).toContain("height={shot.height}");
    expect(carousel).toContain("alt={t(shot.altKey)}");
    expect(carousel).toContain('className="landing-carousel-caption"');
    expect(carousel).toContain('aria-roledescription="carousel"');
  });

  it("RPC do destaque e SECURITY DEFINER com search_path e grants publicos corretos", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("from public");
    expect(migration).toContain("to anon, authenticated, service_role");
    expect(migration).toContain("delete from public.app_config where key = 'featured_public_resource'");
  });

  it("todas as locales tem as chaves novas da Home", () => {
    for (const locale of locales) {
      const json = JSON.parse(read(`src/i18n/resources/${locale}/home.json`));
      expect(json.publicLanding.playNow.length).toBeGreaterThan(3);
      expect(json.publicLanding.exploreMaterials.length).toBeGreaterThan(3);
      expect(json.publicLanding.carousel.catalogAlt.length).toBeGreaterThan(10);
      expect(json.publicLanding.carousel.previous.length).toBeGreaterThan(3);
    }
  });

  it("rotas publicas de estudo montam o InstitutionProvider", () => {
    // Sem isto o visitante recebia RouteErrorBoundary (useInstitution) e nao
    // conseguia jogar sem cadastro — o CTA da Home ficava sem destino real.
    const app = read("src/App.tsx");
    expect(app).toContain('import { InstitutionProvider } from "@/contexts/InstitutionContext";');
    expect(app).toContain('/portal/list/:id/study" element={<InstitutionProvider>');
    expect(app).toContain('/portal/list/:id/mixed-study" element={<InstitutionProvider>');
    expect(app).toContain('/portal/collection/:id/study" element={<InstitutionProvider>');
    expect(app).toContain('/portal/collection/:id/mixed-study" element={<InstitutionProvider>');
  });
});
