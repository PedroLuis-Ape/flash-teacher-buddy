const SITE_URL = "https://www.apeeducation.org";

export interface PublicLearningResourceProfile {
  id: string;
  title: string;
  description: string | null;
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  author_display_name?: string | null;
  author_slug?: string | null;
  author_avatar_url?: string | null;
}

export interface PublicLearningResourceList {
  id: string;
  title: string;
  description: string | null;
  card_count?: number | string | null;
}

function languageTag(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(normalized) ? normalized : fallback;
}

function compact<T>(values: Array<T | null | undefined | false>): T[] {
  return values.filter(Boolean) as T[];
}

export function buildPublicLearningResourceStructuredData(
  resource: PublicLearningResourceProfile,
  lists: PublicLearningResourceList[],
) {
  const canonical = `${SITE_URL}/portal/folder/${resource.id}`;
  const pageId = `${canonical}#page`;
  const resourceId = `${canonical}#learning-resource`;
  const listId = `${canonical}#contents`;
  const authorProfile = resource.author_slug
    ? `${SITE_URL}/portal/professor/${resource.author_slug}`
    : null;
  const authorId = authorProfile ? `${authorProfile}#person` : `${canonical}#author`;
  const languages = Array.from(new Set([
    languageTag(resource.lang_a, "en"),
    languageTag(resource.lang_b, "pt"),
  ]));
  const description = resource.description || `Material público de estudo com ${lists.length} listas no APE.`;

  return {
    "@context": "https://schema.org",
    "@graph": compact([
      {
        "@type": "CollectionPage",
        "@id": pageId,
        url: canonical,
        name: resource.title,
        description,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": resourceId },
        ...(lists.length > 0 ? { hasPart: { "@id": listId } } : {}),
        ...(resource.updated_at ? { dateModified: resource.updated_at } : {}),
      },
      {
        "@type": "LearningResource",
        "@id": resourceId,
        name: resource.title,
        description,
        url: canonical,
        inLanguage: languages,
        learningResourceType: resource.study_type === "language"
          ? ["Flashcards", "Language learning collection"]
          : ["Flashcards", "Study collection"],
        educationalUse: ["Practice", "Active recall", "Self study"],
        isAccessibleForFree: true,
        ...(resource.created_at ? { dateCreated: resource.created_at } : {}),
        ...(resource.updated_at ? { dateModified: resource.updated_at } : {}),
        author: { "@id": authorId },
        provider: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: { "@id": pageId },
        ...(lists.length > 0 ? { hasPart: lists.map((list) => ({ "@id": `${canonical}#list-${list.id}` })) } : {}),
      },
      {
        "@type": "Person",
        "@id": authorId,
        name: resource.author_display_name || "Professor no APE",
        jobTitle: "Professor",
        ...(authorProfile ? { url: authorProfile } : {}),
        ...(resource.author_avatar_url ? { image: resource.author_avatar_url } : {}),
        memberOf: { "@id": `${SITE_URL}/#organization` },
      },
      ...(lists.length > 0
        ? [{
            "@type": "ItemList",
            "@id": listId,
            name: `Listas de ${resource.title}`,
            numberOfItems: lists.length,
            itemListElement: lists.map((list, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "LearningResource",
                "@id": `${canonical}#list-${list.id}`,
                name: list.title,
                ...(list.description ? { description: list.description } : {}),
                url: `${SITE_URL}/portal/list/${list.id}/games`,
                isPartOf: { "@id": resourceId },
              },
            })),
          }]
        : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: compact([
          { "@type": "ListItem", position: 1, name: "Portal público", item: `${SITE_URL}/portal` },
          authorProfile
            ? { "@type": "ListItem", position: 2, name: resource.author_display_name || "Professor", item: authorProfile }
            : null,
          {
            "@type": "ListItem",
            position: authorProfile ? 3 : 2,
            name: resource.title,
            item: canonical,
          },
        ]),
      },
    ]),
  };
}
