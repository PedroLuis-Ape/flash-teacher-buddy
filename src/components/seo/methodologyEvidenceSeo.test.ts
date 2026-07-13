import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pagesConfig from "../../../config/public-seo-methodology-evidence.json";
import { buildMethodologyEvidenceJsonLd } from "@/pages/seo/MethodologyEvidencePage";

describe("methodology and evidence SEO", () => {
  it("publishes four reciprocal bilingual articles", () => {
    expect(pagesConfig.map((page) => page.path)).toEqual([
      "/pt-br/metodologia",
      "/pt-br/evidencias",
      "/en/methodology",
      "/en/evidence",
    ]);

    for (const page of pagesConfig) {
      expect(page.schemaType).toBe("Article");
      expect(page.sections.length).toBeGreaterThanOrEqual(5);
      expect(page.references.length).toBe(6);
      expect(page.evidenceNotice.text.length).toBeGreaterThan(100);
      expect(page.alternates.some((alternate) => alternate.href === page.path)).toBe(true);
    }
  });

  it("connects article authorship, publisher and scholarly citations", () => {
    const data = buildMethodologyEvidenceJsonLd(pagesConfig[0] as never);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const article = graph.find((node) => node["@type"] === "Article") as Record<string, unknown>;
    const citations = article.citation as Array<Record<string, unknown>>;

    expect(article.author).toEqual({ "@id": "https://www.apeeducation.org/#pedro-luis-de-oliveira-silva" });
    expect(article.publisher).toEqual({ "@id": "https://www.apeeducation.org/#organization" });
    expect(article.datePublished).toBe("2026-07-13");
    expect(article.dateModified).toBe("2026-07-13");
    expect(citations).toHaveLength(6);
    expect(citations.every((citation) => citation["@type"] === "ScholarlyArticle")).toBe(true);
    expect(JSON.stringify(data)).toContain("10.1177/1529100612453266");
  });

  it("keeps one canonical content source for React and prerender", () => {
    const component = readFileSync("src/pages/seo/MethodologyEvidencePage.tsx", "utf8");
    const prerender = readFileSync("scripts/prerender-methodology-evidence.mjs", "utf8");
    const packageJson = readFileSync("package.json", "utf8");

    expect(component).toContain('public-seo-methodology-evidence.json');
    expect(prerender).toContain('config/public-seo-methodology-evidence.json');
    expect(packageJson).toContain("validate-methodology-evidence-source.mjs");
    expect(packageJson).toContain("prerender-methodology-evidence.mjs");
    expect(packageJson).toContain("validate-methodology-evidence-prerender.mjs");
  });

  it("does not present the product as experimentally validated", () => {
    const serialized = JSON.stringify(pagesConfig).toLowerCase();
    expect(serialized).toContain("não foi avaliado em um ensaio randomizado");
    expect(serialized).toContain("has not yet been evaluated in its own randomized trial");
    expect(serialized).not.toContain("clinicamente comprovado");
    expect(serialized).not.toContain("clinically proven");
    expect(serialized).not.toContain("garante aprendizagem");
    expect(serialized).not.toContain("guarantees learning");
  });
});
