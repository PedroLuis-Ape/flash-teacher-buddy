import { EditorialContent } from "@/components/seo/EditorialPage";
import { SEOHead } from "@/components/seo/SEOHead";
import { buildEditorialStructuredData } from "@/components/seo/editorialStructuredData";
import { requireEditorialPage } from "@/content/public/editorialMaster";
import PublicPortalTopFirst from "./PublicPortalTopFirst";

export default function PublicPortal() {
  const page = requireEditorialPage("/portal");

  return (
    <>
      <PublicPortalTopFirst />
      <SEOHead
        title={page.title}
        description={page.description}
        path={page.path}
        language={page.locale}
        jsonLd={buildEditorialStructuredData(page)}
      />
      <section aria-label="Informações editoriais do portal" className="border-t border-border/60 bg-background">
        <EditorialContent page={page} compact />
      </section>
    </>
  );
}
