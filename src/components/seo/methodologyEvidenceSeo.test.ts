import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEditorialStructuredData } from "@/components/seo/editorialStructuredData";
import { editorialPages, requireEditorialPage } from "@/content/public/editorialMaster";

const read = (path: string) => readFileSync(path, "utf8");
const articlePaths = [
  "/pt-br/metodologia",
  "/pt-br/evidencias",
  "/en/methodology",
  "/en/evidence",
];

describe("methodology and evidence SEO", () => {
  it("publishes four reciprocal bilingual articles", () => {
    const articles = articlePaths.map((path) => requireEditorialPage(path));

    expect(articles.map((page) => page.path)).toEqual(articlePaths);
    for (const page of articles) {
      expect(page.schema).toContain("Article");
      expect(page.sections.length).toBeGreaterThanOrEqual(5);
      expect(page.references).toHaveLength(6);
      expect(page.intro.join(" ").length).toBeGreaterThan(100);
    }

    expect(editorialPages.some((page) => page.path === "/pt-br/metodologia")).toBe(true);
    expect(editorialPages.some((page) => page.path === "/en/methodology")).toBe(true);
  });

  it("connects article authorship, publisher and scholarly citations", () => {
    const page = requireEditorialPage("/pt-br/metodologia");
    const data = buildEditorialStructuredData(page);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const article = graph.find((node) => node["@type"] === "Article") as Record<string, unknown>;
    const citations = article.citation as Array<Record<string, unknown>>;

    expect(article.author).toEqual({ "@id": "https://www.apeeducation.org/#pedro-luis" });
    expect(article.publisher).toEqual({ "@id": "https://www.apeeducation.org/#organization" });
    expect(article.datePublished).toBe(page.datePublished);
    expect(article.dateModified).toBe("2026-07-25");
    expect(citations).toHaveLength(6);
    expect(citations.every((citation) => citation["@type"] === "ScholarlyArticle")).toBe(true);
    expect(JSON.stringify(data)).toContain("10.1177/1529100612453266");
  });

  it("uses the editorial master as the canonical React and prerender source", () => {
    const component = read("src/pages/seo/MethodologyEvidencePage.tsx");
    const editorialMaster = read("src/content/public/editorialMaster.ts");
    const prerender = read("scripts/prerender-public-pages.mjs");
    const packageJson = read("package.json");

    expect(component).toContain("EditorialPage");
    expect(component).toContain("location.pathname");
    expect(editorialMaster).toContain("pt-docs-b2.json");
    expect(editorialMaster).toContain("en-b.json");
    expect(prerender).toContain("loadEditorialPages");
    expect(packageJson).toContain("prerender-public-pages.mjs");
    expect(packageJson).toContain("validate-prerender.mjs");
  });

  it("does not present the product as experimentally validated", () => {
    const serialized = JSON.stringify(articlePaths.map((path) => requireEditorialPage(path))).toLowerCase();

    expect(serialized).toContain("ensaio randomizado próprio");
    expect(serialized).toContain("randomized controlled trial");
    expect(serialized).not.toContain("clinicamente comprovado");
    expect(serialized).not.toContain("clinically proven");
    expect(serialized).not.toContain("garante aprendizagem");
    expect(serialized).not.toContain("guarantees learning");
  });
});
