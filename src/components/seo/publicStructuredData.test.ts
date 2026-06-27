import { describe, expect, it } from "vitest";
import { buildPublicPageStructuredData } from "./publicStructuredData";

function graphOf(value: Record<string, unknown>) {
  return value["@graph"] as Record<string, unknown>[];
}

function findById(graph: Record<string, unknown>[], id: string) {
  return graph.find((node) => node["@id"] === id);
}

describe("public structured data graph", () => {
  it("links the homepage to stable organization, website and app entities", () => {
    const value = buildPublicPageStructuredData({
      path: "/",
      title: "APE — Inglês com Flashcards",
      description: "Plataforma educacional de prática ativa.",
      name: "Inglês com flashcards",
      applicationAsMainEntity: true,
    });
    const graph = graphOf(value);
    const page = findById(graph, "https://www.apeeducation.org/#webpage");

    expect(value["@context"]).toBe("https://schema.org");
    expect(findById(graph, "https://www.apeeducation.org/#organization")?.["@type"]).toBe("Organization");
    expect(findById(graph, "https://www.apeeducation.org/#website")?.["@type"]).toBe("WebSite");
    expect(findById(graph, "https://www.apeeducation.org/#app")?.["@type"]).toBe("SoftwareApplication");
    expect(page?.mainEntity).toEqual([{ "@id": "https://www.apeeducation.org/#app" }]);
    expect(graph.some((node) => node["@type"] === "SearchAction")).toBe(false);
  });

  it("adds breadcrumbs and preserves a learning resource as the main entity", () => {
    const value = buildPublicPageStructuredData({
      path: "/ingles-para-iniciantes",
      title: "Inglês para Iniciantes | APE",
      description: "Vocabulário, frases e prática guiada.",
      name: "Inglês para iniciantes",
      mainEntity: {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: "Inglês para Iniciantes — APE",
        educationalLevel: "Beginner",
      },
    });
    const graph = graphOf(value);
    const canonical = "https://www.apeeducation.org/ingles-para-iniciantes";
    const page = findById(graph, `${canonical}#webpage`);
    const resource = findById(graph, `${canonical}#main-entity`);

    expect(findById(graph, `${canonical}#breadcrumb`)?.["@type"]).toBe("BreadcrumbList");
    expect(page?.breadcrumb).toEqual({ "@id": `${canonical}#breadcrumb` });
    expect(page?.mainEntity).toEqual([{ "@id": `${canonical}#main-entity` }]);
    expect(resource?.["@type"]).toBe("LearningResource");
    expect(resource?.mainEntityOfPage).toEqual({ "@id": `${canonical}#webpage` });
    expect(resource).not.toHaveProperty("@context");
  });
});
