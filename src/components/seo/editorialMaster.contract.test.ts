import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const json = <T,>(path: string) => JSON.parse(read(path)) as T;

interface Page {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  sections: Array<{ heading: string; paragraphs: string[]; items: string[] }>;
  faq: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ href: string; label: string }>;
  dateModified: string;
  locale: string;
  references?: unknown[];
}

const individualFiles = [
  "home.json",
  "atividades-de-ingles.json",
  "flashcards-de-ingles.json",
  "ingles-para-iniciantes.json",
  "para-professores.json",
  "about.json",
  "portal.json",
];
const groupedFiles = ["pt-docs-a.json", "pt-docs-b1.json", "pt-docs-b2.json", "en-a.json", "en-b.json"];

function pages() {
  return [
    ...individualFiles.map((file) => json<Page>(`config/editorial/${file}`)),
    ...groupedFiles.flatMap((file) => json<Page[]>(`config/editorial/${file}`)),
  ];
}

describe("editorial master contract", () => {
  it("publishes all 23 reviewed routes from the document", () => {
    const all = pages();
    expect(all).toHaveLength(23);
    expect(new Set(all.map((page) => page.path)).size).toBe(23);

    for (const page of all) {
      expect(page.title.length).toBeGreaterThanOrEqual(25);
      expect(page.description.length).toBeGreaterThanOrEqual(80);
      expect(page.h1.length).toBeGreaterThanOrEqual(15);
      expect(page.intro.length).toBeGreaterThanOrEqual(1);
      expect(page.sections.length).toBeGreaterThanOrEqual(2);
      expect(page.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(JSON.stringify(page)).not.toContain("PLACEHOLDER");
    }
  });

  it("keeps Portuguese and English authority routes paired", () => {
    const source = read("src/content/public/editorialMaster.ts");
    const pairs = [
      ["/pt-br", "/en"],
      ["/pt-br/recursos", "/en/features"],
      ["/pt-br/flashcards", "/en/flashcards"],
      ["/pt-br/para-professores", "/en/for-teachers"],
      ["/pt-br/sobre", "/en/about"],
      ["/pt-br/fonte-oficial", "/en/official-source"],
      ["/pt-br/metodologia", "/en/methodology"],
      ["/pt-br/evidencias", "/en/evidence"],
    ];
    for (const [pt, en] of pairs) {
      expect(source).toContain(`"${pt}": "${en}"`);
      expect(source).toContain(`"${en}": "${pt}"`);
    }
  });

  it("uses verified Preply data only as professional social proof", () => {
    const meta = json<{
      preply: {
        url: string;
        verifiedAt: string;
        lessons: number;
        activeStudents: number;
        publicReviews: number;
        publicRating: number;
        anonymousLessonReviews: number;
        stableLessonClaim: string;
      };
    }>("config/editorial/editorial-meta.json");
    const schema = read("src/components/seo/editorialStructuredData.ts");
    const page = read("src/components/seo/EditorialPage.tsx");

    expect(meta.preply.url).toBe("https://preply.com/pt/professor/6349931");
    expect(meta.preply.verifiedAt).toBe("2026-07-25");
    expect(meta.preply.lessons).toBe(1971);
    expect(meta.preply.activeStudents).toBe(26);
    expect(meta.preply.publicReviews).toBe(42);
    expect(meta.preply.publicRating).toBe(4.8);
    expect(meta.preply.anonymousLessonReviews).toBe(65);
    expect(meta.preply.stableLessonClaim).toContain("mais de 1.900");
    expect(schema).toContain("editorialMeta.preply.url");
    expect(schema).toContain("github.com/PedroLuis-Ape");
    expect(schema).not.toContain("AggregateRating");
    expect(schema).not.toContain('"@type": "Review"');
    expect(page).toContain("não uma avaliação científica do software");
  });

  it("keeps headings solid and all important content visible", () => {
    const layout = read("src/components/seo/EditorialPage.tsx");
    expect(layout).toContain("text-foreground");
    expect(layout).not.toContain("text-transparent");
    expect(layout).not.toContain("bg-clip-text");
    expect(layout).toContain("EditorialSections");
    expect(layout).toContain("EditorialFaq");
    expect(layout).toContain("EditorialReferences");
    expect(layout).toContain("EditorialAuthorCard");
  });

  it("routes every static public page through the shared renderer", () => {
    const wrappers = {
      "src/pages/LandingPage.tsx": 'EditorialPage path="/"',
      "src/pages/seo/AtividadesDeIngles.tsx": 'path="/atividades-de-ingles"',
      "src/pages/seo/FlashcardsDeIngles.tsx": 'path="/flashcards-de-ingles"',
      "src/pages/seo/InglesParaIniciantes.tsx": 'path="/ingles-para-iniciantes"',
      "src/pages/seo/ParaProfessores.tsx": 'path="/para-professores"',
      "src/pages/About.tsx": 'path="/about"',
    };
    for (const [path, expected] of Object.entries(wrappers)) expect(read(path)).toContain(expected);
    expect(read("src/pages/seo/InternationalSEOPage.tsx")).toContain("location.pathname");
    expect(read("src/pages/seo/OfficialSourcePage.tsx")).toContain("location.pathname");
    expect(read("src/pages/seo/MethodologyEvidencePage.tsx")).toContain("location.pathname");
  });

  it("documents public profiles, folders, lists and collections without exposing private data", () => {
    const dynamic = read("src/components/seo/DynamicPublicEditorialNote.tsx");
    expect(dynamic).toContain("/portal/professor/");
    expect(dynamic).toContain("/portal/folder/");
    expect(dynamic).toContain("/portal/list/");
    expect(dynamic).toContain("/portal/collection/");
    expect(dynamic).toContain("turmas privadas");
    expect(dynamic).toContain("não expõe outras pastas pessoais");
  });
});
