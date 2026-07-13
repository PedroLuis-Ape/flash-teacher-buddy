import { ExternalLink, Languages, Scale, ScrollText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicThemeToggle } from "@/components/seo/PublicThemeToggle";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import pagesConfig from "../../../config/public-seo-methodology-evidence.json";

const SITE_URL = "https://www.apeeducation.org";

type Locale = "pt-BR" | "en";

type Reference = {
  id: string;
  authors: string;
  year: number;
  title: string;
  publication: string;
  doi: string;
  url: string;
};

type ArticleSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

type MethodologyArticle = {
  path: string;
  language: Locale;
  title: string;
  description: string;
  h1: string;
  intro: string;
  eyebrow: string;
  datePublished: string;
  dateModified: string;
  schemaType: "Article";
  evidenceNotice: { heading: string; text: string };
  sections: ArticleSection[];
  referencesHeading: string;
  referencesIntro: string;
  references: Reference[];
  links: Array<{ href: string; label: string }>;
  alternates: Array<{ hrefLang: string; href: string }>;
};

const pages = pagesConfig as MethodologyArticle[];

function absolute(path: string) {
  return `${SITE_URL}${path}`;
}

export function buildMethodologyEvidenceJsonLd(page: MethodologyArticle) {
  const canonical = absolute(page.path);
  const organizationId = `${SITE_URL}/#organization`;
  const personId = `${SITE_URL}/#pedro-luis-de-oliveira-silva`;
  const websiteId = `${SITE_URL}/#website`;
  const english = page.language === "en";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name: "Pedro Luis de Oliveira Silva",
        jobTitle: english ? "Founder and creator of APE" : "Fundador e criador do APE",
      },
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "APE Education",
        alternateName: ["APE", "App Piteco"],
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/branding/icon.png` },
        founder: { "@id": personId },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "APE — Apprentice Practice & Enhancement",
        alternateName: "App Piteco",
        url: `${SITE_URL}/`,
        inLanguage: ["pt-BR", "en"],
        publisher: { "@id": organizationId },
      },
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        url: canonical,
        mainEntityOfPage: { "@id": `${canonical}#webpage` },
        headline: page.h1,
        name: page.title,
        description: page.description,
        inLanguage: page.language,
        datePublished: page.datePublished,
        dateModified: page.dateModified,
        author: { "@id": personId },
        publisher: { "@id": organizationId },
        about: [
          { "@type": "Thing", name: english ? "Retrieval practice" : "Prática de recuperação" },
          { "@type": "Thing", name: english ? "Distributed practice" : "Prática distribuída" },
          { "@type": "Thing", name: english ? "Learning transfer" : "Transferência de aprendizagem" },
          { "@type": "SoftwareApplication", "@id": `${SITE_URL}/#application`, name: "APE — Apprentice Practice & Enhancement" },
        ],
        citation: page.references.map((reference) => ({
          "@type": "ScholarlyArticle",
          "@id": reference.url,
          name: reference.title,
          author: reference.authors,
          datePublished: String(reference.year),
          isPartOf: reference.publication,
          sameAs: reference.url,
          identifier: `https://doi.org/${reference.doi}`,
        })),
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: page.h1,
        description: page.description,
        inLanguage: page.language,
        datePublished: page.datePublished,
        dateModified: page.dateModified,
        isPartOf: { "@id": websiteId },
        mainEntity: { "@id": `${canonical}#article` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: english ? "Home" : "Início",
            item: absolute(english ? "/en" : "/pt-br"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.h1,
            item: canonical,
          },
        ],
      },
    ],
  };
}

function findPage(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return pages.find((candidate) => candidate.path === normalized) ?? pages[0];
}

export default function MethodologyEvidencePage() {
  const location = useLocation();
  const page = findPage(location.pathname);
  const english = page.language === "en";
  const paired = page.alternates.find(
    (alternate) => alternate.hrefLang !== page.language && alternate.hrefLang !== "x-default",
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title={page.title}
        description={page.description}
        path={page.path}
        language={page.language}
        imageAlt={english ? "APE methodology and evidence" : "Metodologia e evidências do APE"}
        alternates={page.alternates}
        jsonLd={buildMethodologyEvidenceJsonLd(page)}
      />

      <header className="border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to={english ? "/en" : "/pt-br"} className="flex items-center gap-3 font-extrabold">
            <PitecoLogo className="h-10 w-10" />
            <span>APE — App Piteco</span>
          </Link>
          <div className="flex items-center gap-2">
            {paired && (
              <Link
                to={paired.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-bold hover:bg-muted"
              >
                <Languages className="h-4 w-4" />
                {english ? "Português" : "English"}
              </Link>
            )}
            <PublicThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <article>
          <header className="max-w-4xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
              <ScrollText className="h-4 w-4" />
              {page.eyebrow}
            </p>
            <h1 className="text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
              {page.intro}
            </p>
            <p className="mt-4 text-sm font-semibold text-muted-foreground">
              {english ? "Published and last reviewed" : "Publicada e revisada em"}: {page.dateModified}
            </p>
          </header>

          <aside className="my-10 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6" aria-labelledby="evidence-boundary">
            <div className="flex items-start gap-3">
              <Scale className="mt-1 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <h2 id="evidence-boundary" className="text-xl font-black">{page.evidenceNotice.heading}</h2>
                <p className="mt-2 leading-7 text-muted-foreground">{page.evidenceNotice.text}</p>
              </div>
            </div>
          </aside>

          <div className="space-y-12">
            {page.sections.map((section) => (
              <section key={section.heading} className="scroll-mt-24">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 max-w-4xl text-[1.05rem] leading-8 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.items?.length ? (
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <li key={item} className="rounded-xl border border-border bg-card p-4 leading-7 text-card-foreground">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <section className="mt-16 border-t border-border pt-10" aria-labelledby="research-references">
            <h2 id="research-references" className="text-3xl font-black tracking-tight">{page.referencesHeading}</h2>
            <p className="mt-3 max-w-4xl leading-7 text-muted-foreground">{page.referencesIntro}</p>
            <ol className="mt-7 space-y-4">
              {page.references.map((reference) => (
                <li key={reference.id} id={reference.id} className="rounded-xl border border-border bg-card p-5">
                  <p className="font-bold">{reference.authors} ({reference.year}).</p>
                  <p className="mt-1 italic">{reference.title}.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{reference.publication}.</p>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 font-bold text-primary underline-offset-4 hover:underline"
                  >
                    DOI: {reference.doi}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <nav className="mt-14 rounded-2xl border border-border bg-muted/40 p-6" aria-label={english ? "Related pages" : "Páginas relacionadas"}>
            <h2 className="text-xl font-black">{english ? "Continue reading" : "Continue a leitura"}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {page.links.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="block rounded-xl border border-border bg-background p-4 font-bold hover:border-primary/50 hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
    </div>
  );
}
