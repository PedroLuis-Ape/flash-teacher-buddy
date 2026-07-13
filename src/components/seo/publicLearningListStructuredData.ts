const SITE_URL = "https://www.apeeducation.org";

export type PublicLearningListCard = {
  id: string;
  term: string;
  translation: string;
  created_at?: string | null;
};

export type PublicLearningList = {
  id: string;
  folder_id: string;
  title: string;
  description?: string | null;
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  folder_title?: string | null;
  author_display_name?: string | null;
  author_slug?: string | null;
  author_avatar_url?: string | null;
  card_count?: number | string | null;
};

const absolute = (path: string) => `${SITE_URL}${path}`;

export function publicLearningListDescription(list: PublicLearningList) {
  const normalized = list.description?.replace(/\s+/g, " ").trim();
  if (normalized) return normalized.length <= 155 ? normalized : `${normalized.slice(0, 152).trimEnd()}…`;
  const count = Number(list.card_count ?? 0);
  return `${list.title}: lista pública de estudo com ${Number.isFinite(count) ? count : 0} cards no APE.`;
}

export function buildPublicLearningListStructuredData(
  list: PublicLearningList,
  cards: PublicLearningListCard[] = [],
) {
  const canonical = absolute(`/portal/list/${list.id}`);
  const folderUrl = absolute(`/portal/folder/${list.folder_id}`);
  const authorUrl = list.author_slug ? absolute(`/portal/professor/${list.author_slug}`) : null;
  const pageId = `${canonical}#page`;
  const resourceId = `${canonical}#learning-resource`;
  const authorId = authorUrl ? `${authorUrl}#person` : `${canonical}#author`;
  const previewId = `${canonical}#card-preview`;
  const languages = Array.from(new Set([list.lang_a || "en", list.lang_b || "pt"]));
  const description = publicLearningListDescription(list);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageId,
        url: canonical,
        name: list.title,
        description,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": resourceId },
        ...(list.updated_at ? { dateModified: list.updated_at } : {}),
      },
      {
        "@type": "LearningResource",
        "@id": resourceId,
        url: canonical,
        name: list.title,
        description,
        inLanguage: languages,
        learningResourceType: list.study_type === "language"
          ? ["Flashcards", "Language learning list"]
          : ["Flashcards", "Study list"],
        educationalUse: ["Practice", "Active recall", "Self study"],
        isAccessibleForFree: true,
        author: { "@id": authorId },
        provider: { "@id": `${SITE_URL}/#organization` },
        isPartOf: {
          "@type": "LearningResource",
          "@id": `${folderUrl}#learning-resource`,
          url: folderUrl,
          name: list.folder_title || "Material público",
        },
        mainEntityOfPage: { "@id": pageId },
        ...(list.created_at ? { dateCreated: list.created_at } : {}),
        ...(list.updated_at ? { dateModified: list.updated_at } : {}),
        ...(cards.length ? { hasPart: { "@id": previewId } } : {}),
      },
      {
        "@type": "Person",
        "@id": authorId,
        name: list.author_display_name || "Professor no APE",
        jobTitle: "Professor",
        ...(authorUrl ? { url: authorUrl } : {}),
        ...(list.author_avatar_url ? { image: list.author_avatar_url } : {}),
        memberOf: { "@id": `${SITE_URL}/#organization` },
      },
      ...(cards.length ? [{
        "@type": "ItemList",
        "@id": previewId,
        name: `Prévia de ${list.title}`,
        numberOfItems: cards.length,
        itemListElement: cards.map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: card.term,
          description: card.translation,
        })),
      }] : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Portal público", item: absolute("/portal") },
          ...(authorUrl ? [{
            "@type": "ListItem",
            position: 2,
            name: list.author_display_name || "Professor",
            item: authorUrl,
          }] : []),
          {
            "@type": "ListItem",
            position: authorUrl ? 3 : 2,
            name: list.folder_title || "Material público",
            item: folderUrl,
          },
          {
            "@type": "ListItem",
            position: authorUrl ? 4 : 3,
            name: list.title,
            item: canonical,
          },
        ],
      },
    ],
  };
}
