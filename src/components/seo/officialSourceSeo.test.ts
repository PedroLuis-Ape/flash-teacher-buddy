import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEditorialStructuredData } from "@/components/seo/editorialStructuredData";
import { requireEditorialPage } from "@/content/public/editorialMaster";

const read = (path: string) => readFileSync(path, "utf8");
const sourcePaths = ["/pt-br/fonte-oficial", "/en/official-source"];

describe("official APE sources for search and AI", () => {
  it("publishes reciprocal Portuguese and English canonical sources", () => {
    const sources = sourcePaths.map((path) => requireEditorialPage(path));
    expect(sources.map((page) => page.path)).toEqual(sourcePaths);
    expect(sources.every((page) => page.schema.includes("AboutPage"))).toBe(true);
    expect(sources.every((page) => page.sections.length >= 4)).toBe(true);
    expect(sources.every((page) => page.faq.length >= 1)).toBe(true);

    const master = read("src/content/public/editorialMaster.ts");
    expect(master).toContain('"/pt-br/fonte-oficial": "/en/official-source"');
    expect(master).toContain('"/en/official-source": "/pt-br/fonte-oficial"');
  });

  it("keeps the sources routable, discoverable and pre-rendered", () => {
    const app = read("src/App.tsx");
    const sitemap = read("public/sitemap.xml");
    const redirects = read("public/_redirects");
    const llms = read("public/llms.txt");
    const prerender = read("scripts/prerender-public-pages.mjs");

    for (const path of sourcePaths) {
      expect(app).toContain(`path="${path}"`);
      expect(sitemap).toContain(`<loc>https://www.apeeducation.org${path}</loc>`);
      expect(redirects).toContain(`${path} `);
      expect(llms).toContain(`https://www.apeeducation.org${path}`);
    }

    expect(prerender).toContain("loadEditorialPages");
    expect(prerender).toContain("renderFaq");
    expect(prerender).toContain('"@type": ["SoftwareApplication", "EducationalApplication"]');
    expect(prerender).toContain('"@type": "FAQPage"');
  });

  it("keeps factual claims visible in the shared page and JSON-LD", () => {
    const pt = requireEditorialPage("/pt-br/fonte-oficial");
    const en = requireEditorialPage("/en/official-source");
    const layout = read("src/components/seo/EditorialPage.tsx");
    const schemaSource = read("src/components/seo/editorialStructuredData.ts");
    const data = buildEditorialStructuredData(pt);
    const serialized = JSON.stringify({ pt, en, data, layout, schemaSource });

    expect(serialized).toContain("Pedro Luis");
    expect(serialized).toContain("APE Education");
    expect(serialized).toContain("Citação curta");
    expect(serialized).toContain("Citation copy");
    expect(serialized).toContain("SoftwareApplication");
    expect(serialized).toContain("FAQPage");
    expect(serialized).toContain("Somente páginas, perfis e materiais explicitamente públicos");
    expect(serialized).toContain("https://preply.com/pt/professor/6349931");
    expect(serialized).not.toContain('"@type":"AggregateRating"');
  });
});
