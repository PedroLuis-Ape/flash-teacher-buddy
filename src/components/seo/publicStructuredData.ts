const SITE_URL = "https://www.apeeducation.org";
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#app`;

type JsonLdNode = Record<string, unknown>;
type PublicPageType = "WebPage" | "CollectionPage" | "AboutPage";

interface PublicPageStructuredDataOptions {
  path: string;
  title: string;
  description: string;
  name: string;
  pageType?: PublicPageType;
  pageProperties?: JsonLdNode;
  mainEntity?: JsonLdNode | JsonLdNode[];
  applicationAsMainEntity?: boolean;
}

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function absoluteUrl(path: string) {
  const normalized = normalizePath(path);
  return normalized === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

function withoutContext(node: JsonLdNode): JsonLdNode {
  const { "@context": _context, ...rest } = node;
  return rest;
}

function buildOrganization(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "APE Education",
    alternateName: ["APE", "App Piteco"],
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/branding/icon.png`,
    },
    description:
      "Plataforma educacional brasileira de flashcards, estudo ativo e organização de materiais para alunos e professores.",
  };
}

function buildWebsite(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "APE — Apprentice Practice & Enhancement",
    alternateName: "App Piteco",
    url: `${SITE_URL}/`,
    inLanguage: "pt-BR",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

function buildApplication(description: string): JsonLdNode {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: "APE — App Piteco",
    alternateName: "Apprentice Practice & Enhancement",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description,
    url: `${SITE_URL}/`,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

function buildBreadcrumb(path: string, name: string): JsonLdNode | null {
  const canonical = absoluteUrl(path);
  if (canonical === `${SITE_URL}/`) return null;

  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: canonical,
      },
    ],
  };
}

export function buildPublicPageStructuredData({
  path,
  title,
  description,
  name,
  pageType = "WebPage",
  pageProperties = {},
  mainEntity,
  applicationAsMainEntity = false,
}: PublicPageStructuredDataOptions): JsonLdNode {
  const canonical = absoluteUrl(path);
  const pageId = `${canonical}#webpage`;
  const graph: JsonLdNode[] = [
    buildOrganization(),
    buildWebsite(),
    buildApplication(description),
  ];

  const rawEntities = mainEntity
    ? Array.isArray(mainEntity)
      ? mainEntity
      : [mainEntity]
    : [];

  const entities = rawEntities.map((entity, index) => ({
    ...withoutContext(entity),
    "@id": entity["@id"] ?? `${canonical}#main-entity${index ? `-${index + 1}` : ""}`,
    url: entity.url ?? canonical,
    mainEntityOfPage: entity.mainEntityOfPage ?? { "@id": pageId },
  }));

  const mainEntityReferences = [
    ...(applicationAsMainEntity ? [{ "@id": APP_ID }] : []),
    ...entities.map((entity) => ({ "@id": entity["@id"] })),
  ];

  const breadcrumb = buildBreadcrumb(path, name);
  if (breadcrumb) graph.push(breadcrumb);

  graph.push({
    ...pageProperties,
    "@type": pageType,
    "@id": pageId,
    url: canonical,
    name,
    headline: title,
    description,
    inLanguage: "pt-BR",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": APP_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(breadcrumb ? { breadcrumb: { "@id": breadcrumb["@id"] } } : {}),
    ...(mainEntityReferences.length > 0 ? { mainEntity: mainEntityReferences } : {}),
  });

  graph.push(...entities);

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
