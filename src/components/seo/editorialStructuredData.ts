import {
  editorialMeta,
  getEditorialAlternates,
  getEditorialHomePath,
  getEditorialLocaleCopy,
  getPairedEditorialRoute,
  type EditorialPageDefinition,
} from "@/content/public/editorialMaster";

const SITE_URL = editorialMeta.siteUrl;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APPLICATION_ID = `${SITE_URL}/#application`;
const PERSON_ID = `${SITE_URL}/#pedro-luis`;

function absolute(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function pageType(page: EditorialPageDefinition) {
  if (page.schema.includes("AboutPage")) return "AboutPage";
  if (page.schema.includes("CollectionPage")) return "CollectionPage";
  return "WebPage";
}

export function buildEditorialStructuredData(page: EditorialPageDefinition) {
  const canonical = absolute(page.path);
  const pageId = `${canonical}#webpage`;
  const faqId = `${canonical}#faq`;
  const articleId = `${canonical}#article`;
  const resourceId = `${canonical}#learning-resource`;
  const copy = getEditorialLocaleCopy(page.locale);
  const pairedRoute = getPairedEditorialRoute(page.path);
  const localeAlternates = getEditorialAlternates(page.path);
  const translatedRoute = localeAlternates.find((alternate) => alternate.hrefLang !== page.locale && alternate.hrefLang !== "x-default")?.href ?? pairedRoute;
  const supportedLanguages = ["pt-BR", "en", "es", "fr", "it", "de"];

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Person",
      "@id": PERSON_ID,
      name: "Pedro Luis",
      jobTitle: copy.jobTitle,
      url: absolute(getEditorialHomePath(page.locale)),
      sameAs: [
        editorialMeta.preply.url,
        "https://github.com/PedroLuis-Ape",
        "https://github.com/PedroLuis-Ape/flash-teacher-buddy",
      ],
      knowsLanguage: supportedLanguages,
    },
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "APE Education",
      alternateName: ["APE", "App Piteco"],
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/branding/icon.png` },
      founder: { "@id": PERSON_ID },
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: "APE — Apprentice Practice & Enhancement",
      alternateName: "App Piteco",
      url: `${SITE_URL}/`,
      inLanguage: supportedLanguages,
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@type": ["SoftwareApplication", "EducationalApplication"],
      "@id": APPLICATION_ID,
      name: "APE — Apprentice Practice & Enhancement",
      alternateName: "App Piteco",
      url: `${SITE_URL}/`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      inLanguage: supportedLanguages,
      creator: { "@id": PERSON_ID },
      publisher: { "@id": ORGANIZATION_ID },
      description: page.description,
    },
  ];

  const mainEntity: Record<string, unknown>[] = [];

  if (page.schema.includes("Article")) {
    graph.push({
      "@type": "Article",
      "@id": articleId,
      url: canonical,
      mainEntityOfPage: { "@id": pageId },
      headline: page.h1,
      name: page.title,
      description: page.description,
      inLanguage: page.locale,
      datePublished: page.datePublished,
      dateModified: page.dateModified,
      author: { "@id": PERSON_ID },
      publisher: { "@id": ORGANIZATION_ID },
      about: [
        { "@type": "Thing", name: page.locale === "pt-BR" ? "Prática de recuperação" : "Retrieval practice" },
        { "@type": "Thing", name: page.locale === "pt-BR" ? "Prática distribuída" : "Distributed practice" },
        { "@type": "Thing", name: page.locale === "pt-BR" ? "Transferência de aprendizagem" : "Learning transfer" },
        { "@id": APPLICATION_ID },
      ],
      citation: (page.references ?? []).map((reference) => ({
        "@type": "ScholarlyArticle",
        "@id": reference.url,
        name: reference.title,
        author: reference.authors,
        datePublished: String(reference.year),
        isPartOf: reference.publication,
        sameAs: reference.url,
        identifier: `https://doi.org/${reference.doi}`,
      })),
    });
    mainEntity.push({ "@id": articleId });
  }

  if (page.schema.includes("LearningResource")) {
    graph.push({
      "@type": "LearningResource",
      "@id": resourceId,
      name: page.h1,
      description: page.description,
      url: canonical,
      inLanguage: page.locale,
      datePublished: page.datePublished,
      dateModified: page.dateModified,
      provider: { "@id": ORGANIZATION_ID },
      author: { "@id": PERSON_ID },
      mainEntityOfPage: { "@id": pageId },
      learningResourceType: page.locale === "pt-BR" ? "Recurso interativo de aprendizagem" : "Interactive learning resource",
    });
    mainEntity.push({ "@id": resourceId });
  }

  if (page.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: page.faq.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
    mainEntity.push({ "@id": faqId });
  }

  if (page.path !== "/") {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: copy.breadcrumb,
          item: absolute(getEditorialHomePath(page.locale)),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.h1,
          item: canonical,
        },
      ],
    });
  }

  graph.push({
    "@type": pageType(page),
    "@id": pageId,
    url: canonical,
    name: page.h1,
    headline: page.title,
    description: page.description,
    inLanguage: page.locale,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": APPLICATION_ID },
    author: { "@id": PERSON_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(page.path !== "/" ? { breadcrumb: { "@id": `${canonical}#breadcrumb` } } : {}),
    ...(mainEntity.length > 0 ? { mainEntity } : { mainEntity: { "@id": APPLICATION_ID } }),
    ...(translatedRoute
      ? {
          translationOfWork: {
            "@type": "WebPage",
            "@id": `${absolute(translatedRoute)}#webpage`,
          },
        }
      : {}),
  });

  return { "@context": "https://schema.org", "@graph": graph };
}
