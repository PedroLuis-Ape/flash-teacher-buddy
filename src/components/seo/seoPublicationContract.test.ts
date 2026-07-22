import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("SEO publication contract", () => {
  it("keeps local runtime examples on the production data project", () => {
    const envExample = read(".env.example");
    expect(envExample).toContain('VITE_SUPABASE_PROJECT_ID="ymahldldyxvwjeruaxpr"');
    expect(envExample).toContain('VITE_SUPABASE_URL="https://ymahldldyxvwjeruaxpr.supabase.co"');
    expect(envExample).not.toContain('VITE_SUPABASE_PROJECT_ID="xrnfhhoxmmstagmelvyi"');
  });

  it("uses safe legacy read gateways when canonical public discovery is pending", () => {
    const resources = read("scripts/public-learning-resource-data.mjs");
    const lists = read("scripts/public-learning-list-data.mjs");
    const folderRoute = read("src/pages/PublicFolderRoute.tsx");
    const listRoute = read("src/pages/PublicLearningListPage.tsx");

    expect(resources).toContain('client.rpc("get_portal_lists_with_counts"');
    expect(resources).toContain('discoveryMode: "teacher-directory-legacy-rpc"');
    expect(lists).toContain('client.rpc("get_portal_flashcards"');
    expect(lists).toContain('discoveryMode: "public-resource-legacy-rpc"');
    expect(folderRoute).toContain('"get_portal_lists_with_counts"');
    expect(listRoute).toContain('"get_portal_flashcards"');
  });

  it("segments sitemaps and archives a fail-closed publication report", () => {
    const packageJson = read("package.json");
    const prepare = read("scripts/prepare-seo-sitemaps.mjs");
    const finalize = read("scripts/finalize-seo-publication-report.mjs");
    const workflow = read(".github/workflows/ci.yml");

    expect(packageJson).toContain("prepare-seo-sitemaps.mjs");
    expect(packageJson).toContain("finalize-seo-publication-report.mjs");
    for (const segment of ["sitemap-static.xml", "sitemap-teachers.xml", "sitemap-folders.xml", "sitemap-lists.xml"]) {
      expect(prepare).toContain(segment);
    }
    expect(finalize).toContain('"runtime:production-project"');
    expect(finalize).toContain('"lists:consistent"');
    expect(finalize).toContain('"fallback:no-preview-failures"');
    expect(workflow).toContain("seo-publication-report.json");
  });

  it("keeps the home sitemap revision aligned with editorial content", () => {
    const landing = JSON.parse(read("config/public-seo-pages.json"))[0];
    const sitemap = read("public/sitemap.xml");
    expect(sitemap).toContain(`<loc>https://www.apeeducation.org/</loc><lastmod>${landing.dateModified}</lastmod>`);
  });
});
