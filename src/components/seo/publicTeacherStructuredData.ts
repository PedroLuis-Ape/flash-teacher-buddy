const SITE_URL = "https://www.apeeducation.org";

export interface PublicTeacherSeoProfile {
  display_name: string;
  avatar_url: string | null;
  public_slug: string;
  public_bio: string | null;
  public_specialties: string[] | null;
}

export interface PublicTeacherSeoFolder {
  id: string;
  title: string;
  description: string | null;
}

export function buildPublicTeacherStructuredData(
  profile: PublicTeacherSeoProfile,
  folders: PublicTeacherSeoFolder[],
) {
  const path = `/portal/professor/${profile.public_slug}`;
  const canonical = `${SITE_URL}${path}`;
  const personId = `${canonical}#person`;
  const profileId = `${canonical}#profile`;
  const materialsId = `${canonical}#materials`;
  const specialties = profile.public_specialties?.filter(Boolean) ?? [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": profileId,
        url: canonical,
        name: `${profile.display_name} | Perfil público no APE`,
        description: profile.public_bio || `Materiais públicos de inglês compartilhados por ${profile.display_name}.`,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": personId },
        ...(folders.length > 0 ? { hasPart: { "@id": materialsId } } : {}),
      },
      {
        "@type": "Person",
        "@id": personId,
        name: profile.display_name,
        ...(profile.public_bio ? { description: profile.public_bio } : {}),
        url: canonical,
        ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
        jobTitle: "Professor",
        ...(specialties.length > 0 ? { knowsAbout: specialties } : {}),
        memberOf: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: { "@id": profileId },
      },
      ...(folders.length > 0
        ? [{
            "@type": "ItemList",
            "@id": materialsId,
            name: `Materiais públicos de ${profile.display_name}`,
            numberOfItems: folders.length,
            itemListElement: folders.map((folder, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${SITE_URL}/portal/folder/${folder.id}`,
              name: folder.title,
              ...(folder.description ? { description: folder.description } : {}),
            })),
          }]
        : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Portal público", item: `${SITE_URL}/portal` },
          { "@type": "ListItem", position: 2, name: profile.display_name, item: canonical },
        ],
      },
    ],
  };
}
