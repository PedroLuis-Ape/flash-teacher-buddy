import { describe, expect, it } from "vitest";
import {
  diffSitemapState,
  extractSitemapEntries,
  extractSitemapLocations,
  inspectHtml,
  isRobotsAllowed,
  parseRobots,
} from "./audit-production-seo.mjs";

describe("production SEO audit helpers", () => {
  it("reads sitemap indexes and page lastmod values", () => {
    expect(extractSitemapLocations(`
      <sitemapindex><sitemap><loc>https://www.apeeducation.org/sitemap-static.xml</loc></sitemap></sitemapindex>
    `)).toEqual(["https://www.apeeducation.org/sitemap-static.xml"]);
    expect(extractSitemapEntries(`
      <urlset><url><loc>https://www.apeeducation.org/pt-br</loc><lastmod>2026-07-22</lastmod></url></urlset>
    `)).toEqual([{ url: "https://www.apeeducation.org/pt-br", lastmod: "2026-07-22" }]);
  });

  it("extracts the required metadata from prerendered HTML", () => {
    const result = inspectHtml(`<!doctype html><html lang="pt-BR"><head>
      <title>APE</title><link href="https://www.apeeducation.org/pt-br" rel="canonical">
      <meta content="index,follow" name="robots"><script type="application/ld+json">{}</script>
      </head><body><h1>Aprenda com prática ativa</h1></body></html>`);
    expect(result).toMatchObject({
      canonical: "https://www.apeeducation.org/pt-br",
      noindex: false,
      title: "APE",
      h1: "Aprenda com prática ativa",
      lang: "pt-BR",
      jsonLdCount: 1,
    });
  });

  it("recognizes noindex independently of attribute order", () => {
    expect(inspectHtml('<html><head><meta content="follow, noindex" name="googlebot"></head></html>').noindex).toBe(true);
  });

  it("applies the longest matching robots rule", () => {
    const groups = parseRobots(`User-agent: *\nDisallow: /portal/\nAllow: /portal/public/`);
    expect(isRobotsAllowed("https://www.apeeducation.org/portal/private", groups)).toBe(false);
    expect(isRobotsAllowed("https://www.apeeducation.org/portal/public/item", groups)).toBe(true);
  });

  it("uses the first valid state as a baseline without generating submissions", () => {
    const current = {
      contractVersion: 1,
      origin: "https://www.apeeducation.org",
      fingerprint: "new",
      pages: [{ url: "https://www.apeeducation.org/", lastmod: "2026-07-22" }],
    };
    expect(diffSitemapState(null, current)).toEqual({ baseline: true, changed: [], removed: [], stateChanged: true });
  });

  it("selects only new or genuinely updated URLs and reports removals separately", () => {
    const previous = {
      contractVersion: 1,
      origin: "https://www.apeeducation.org",
      fingerprint: "old",
      pages: [
        { url: "https://www.apeeducation.org/", lastmod: "2026-07-21" },
        { url: "https://www.apeeducation.org/removed", lastmod: "2026-07-01" },
      ],
    };
    const current = {
      contractVersion: 1,
      origin: "https://www.apeeducation.org",
      fingerprint: "new",
      pages: [
        { url: "https://www.apeeducation.org/", lastmod: "2026-07-22" },
        { url: "https://www.apeeducation.org/new", lastmod: "2026-07-22" },
      ],
    };
    expect(diffSitemapState(previous, current)).toEqual({
      baseline: false,
      changed: ["https://www.apeeducation.org/", "https://www.apeeducation.org/new"],
      removed: ["https://www.apeeducation.org/removed"],
      stateChanged: true,
    });
  });
});
