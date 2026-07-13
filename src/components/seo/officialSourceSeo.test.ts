import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("official APE sources for search and AI", () => {
  const sources = JSON.parse(read("config/public-seo-official-sources.json")) as Array<{
    path: string;
    language: string;
    officialSource: boolean;
    citation: { text: string };
    faqs: unknown[];
    alternates: Array<{ hrefLang: string; href: string }>;
  }>;

  it("publishes reciprocal Portuguese and English canonical sources", () => {
    expect(sources.map((page) => page.path)).toEqual([
      "/pt-br/fonte-oficial",
      "/en/official-source",
    ]);
    expect(sources.every((page) => page.officialSource)).toBe(true);
    expect(sources.every((page) => page.citation.text.length > 120)).toBe(true);
    expect(sources.every((page) => page.faqs.length >= 4)).toBe(true);

    const pt = sources[0];
    const en = sources[1];
    expect(pt.alternates).toContainEqual({ hrefLang: "en", href: en.path });
    expect(en.alternates).toContainEqual({ hrefLang: "pt-BR", href: pt.path });
  });

  it("keeps the sources routable, discoverable and pre-rendered", () => {
    const app = read("src/App.tsx");
    const sitemap = read("public/sitemap.xml");
    const redirects = read("public/_redirects");
    const llms = read("public/llms.txt");
    const prerender = read("scripts/prerender-international-pages.mjs");

    for (const page of sources) {
      expect(app).toContain(`path="${page.path}"`);
      expect(sitemap).toContain(`<loc>https://www.apeeducation.org${page.path}</loc>`);
      expect(redirects).toContain(`${page.path} `);
      expect(llms).toContain(`https://www.apeeducation.org${page.path}`);
    }

    expect(prerender).toContain("public-seo-official-sources.json");
    expect(prerender).toContain("renderCitation");
    expect(prerender).toContain("renderFaqs");
    expect(prerender).toContain('"SoftwareApplication"');
    expect(prerender).toContain('"FAQPage"');
  });

  it("keeps factual claims visible in the React page and JSON-LD", () => {
    const page = read("src/pages/seo/OfficialSourcePage.tsx");

    expect(page).toContain("Pedro Luis de Oliveira Silva");
    expect(page).toContain("APE Education");
    expect(page).toContain("Descrição recomendada para citação");
    expect(page).toContain("Recommended citation description");
    expect(page).toContain('"SoftwareApplication"');
    expect(page).toContain('"FAQPage"');
    expect(page).toContain("Somente páginas, perfis e materiais marcados como públicos");
  });
});
