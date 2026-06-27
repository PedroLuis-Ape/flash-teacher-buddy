import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { Card, CardContent } from "@/components/ui/card";
import { SEOHead, type SEOHeadProps } from "@/components/seo/SEOHead";
import { PublicNav, PublicFooter } from "@/components/seo/PublicNav";
import { PublicBackBar } from "@/components/seo/PublicBackBar";
import { buildPublicPageStructuredData } from "@/components/seo/publicStructuredData";

interface SEOPageProps extends SEOHeadProps {
  h1: string;
  intro: string;
  sections: { title: string; body: ReactNode }[];
  finalCta?: { title: string; text: string; buttonLabel?: string };
}

type PageSchemaType = "WebPage" | "CollectionPage" | "AboutPage";

const PAGE_SCHEMA_TYPES = new Set<PageSchemaType>([
  "WebPage",
  "CollectionPage",
  "AboutPage",
]);

function splitPageSchema(jsonLd: SEOHeadProps["jsonLd"]) {
  if (!jsonLd || Array.isArray(jsonLd)) {
    return {
      pageType: "WebPage" as const,
      pageProperties: {},
      mainEntity: jsonLd,
    };
  }

  const declaredType = jsonLd["@type"];
  if (typeof declaredType !== "string" || !PAGE_SCHEMA_TYPES.has(declaredType as PageSchemaType)) {
    return {
      pageType: "WebPage" as const,
      pageProperties: {},
      mainEntity: jsonLd,
    };
  }

  const {
    "@context": _context,
    "@type": _type,
    "@id": _id,
    name: _name,
    headline: _headline,
    description: _description,
    url: _url,
    inLanguage: _inLanguage,
    isPartOf: _isPartOf,
    publisher: _publisher,
    breadcrumb: _breadcrumb,
    mainEntity: _mainEntity,
    ...pageProperties
  } = jsonLd;

  return {
    pageType: declaredType as PageSchemaType,
    pageProperties,
    mainEntity: undefined,
  };
}

/**
 * Shared layout for static SEO landing pages.
 * Each page receives a consistent Organization, WebSite, SoftwareApplication,
 * WebPage and breadcrumb graph while preserving its page-specific schema.
 */
export function SEOPage({
  h1,
  intro,
  sections,
  finalCta,
  ...seo
}: SEOPageProps) {
  const { pageType, pageProperties, mainEntity } = splitPageSchema(seo.jsonLd);
  const structuredData = buildPublicPageStructuredData({
    path: seo.path,
    title: seo.title,
    description: seo.description,
    name: h1,
    pageType,
    pageProperties,
    mainEntity,
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead {...seo} jsonLd={structuredData} />
      <PublicNav />
      <PublicBackBar />

      <section className="max-w-4xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">
          {h1}
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">{intro}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <AuthAwareCTA guestMode="signup" size="lg">Começar agora</AuthAwareCTA>
          <Button asChild size="lg" variant="outline">
            <Link to="/portal">Ver materiais públicos</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 md:px-6 py-8 w-full space-y-10">
        {sections.map(({ title, body }) => (
          <Card key={title} className="interactive-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">{title}</h2>
              <div className="text-muted-foreground leading-relaxed space-y-3">
                {body}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {finalCta && (
        <section className="max-w-3xl mx-auto px-4 md:px-6 py-16 text-center w-full">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{finalCta.title}</h2>
          <p className="text-muted-foreground mb-6">{finalCta.text}</p>
          <AuthAwareCTA guestMode="signup" size="lg">
            {finalCta.buttonLabel ?? "Criar acesso"}
          </AuthAwareCTA>
        </section>
      )}

      <PublicFooter />
    </div>
  );
}
