import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Languages,
  Quote,
  Scale,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { LandingStickyCTA } from "@/components/cta/LandingStickyCTA";
import { PublicBackBar } from "@/components/seo/PublicBackBar";
import { PublicFooter, PublicNav } from "@/components/seo/PublicNav";
import { SEOHead } from "@/components/seo/SEOHead";
import { buildEditorialStructuredData } from "@/components/seo/editorialStructuredData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  editorialMeta,
  getEditorialRouteLabel,
  getEditorialSecondaryHref,
  getPairedEditorialRoute,
  requireEditorialPage,
  splitEditorialHighlight,
  type EditorialPageDefinition,
} from "@/content/public/editorialMaster";

interface EditorialPageProps {
  path: string;
  afterHero?: ReactNode;
  includeLandingStickyCta?: boolean;
}

interface EditorialContentProps {
  page: EditorialPageDefinition;
  compact?: boolean;
  includeAuthor?: boolean;
}

function formatDate(value: string, locale: EditorialPageDefinition["locale"]) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function linkElement(
  href: string,
  children: ReactNode,
  className?: string,
) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return <Link to={href} className={className}>{children}</Link>;
}

function EditorialAuthorCard({ page }: { page: EditorialPageDefinition }) {
  const english = page.locale === "en";
  const lessonClaim = english
    ? "more than 1,900 lessons taught"
    : editorialMeta.preply.stableLessonClaim;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-foreground">
              {english ? "Authorship and professional context" : "Autoria e contexto profissional"}
            </p>
            <h2 className="mt-1 text-xl font-black">{page.author.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{page.author.role}</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              {english
                ? `Pedro Luis is a Brazilian English tutor and the creator of APE. His public Preply profile documents ${lessonClaim} and a verified teaching certificate. These credentials describe the creator, not a scientific rating of the software.`
                : `Pedro Luis é professor brasileiro de inglês e criador do APE. Seu perfil público na Preply registra ${lessonClaim} e certificado de ensino verificado. Essas credenciais descrevem o criador, não uma avaliação científica do software.`}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {english ? "Page reviewed" : "Página revisada em"} {formatDate(page.dateModified, page.locale)}.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <a href={editorialMeta.preply.url} target="_blank" rel="noreferrer">
            <BadgeCheck className="mr-2 h-4 w-4" />
            {english ? "Verify on Preply" : "Verificar na Preply"}
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function EditorialHighlights({ page }: { page: EditorialPageDefinition }) {
  if (page.highlights.length === 0) return null;

  return (
    <div className="space-y-4">
      {page.highlights.map((highlight) => {
        const parts = splitEditorialHighlight(highlight.text);
        return (
          <Card key={`${highlight.label}:${highlight.text}`} className="overflow-hidden border-primary/30 bg-primary/5">
            <CardContent className="p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <Quote className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black sm:text-2xl">{highlight.label}</h2>
                  {parts.length > 1 ? (
                    <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                      {parts.map((part, index) => (
                        <li key={`${index}:${part}`} className="flex gap-3 rounded-xl border border-primary/15 bg-background/75 p-4 text-sm leading-7">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                            {index + 1}
                          </span>
                          <span>{part}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-[1.02rem] leading-8 text-muted-foreground">{highlight.text}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EditorialSections({ page }: { page: EditorialPageDefinition }) {
  return (
    <div className="space-y-8 sm:space-y-10">
      {page.sections.map((section, sectionIndex) => (
        <section key={`${sectionIndex}:${section.heading}`} className="scroll-mt-24">
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardContent className="p-5 sm:p-7 lg:p-9">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {page.locale === "en" ? `Section ${sectionIndex + 1}` : `Seção ${sectionIndex + 1}`}
                  </p>
                  <h2 className="mt-1 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                    {section.heading}
                  </h2>
                </div>
              </div>

              {section.paragraphs.length > 0 && (
                <div className="mt-5 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="max-w-4xl text-[1.02rem] leading-8 text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {section.items.length > 0 && (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-sm leading-7 sm:text-base">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}

function EditorialFaq({ page }: { page: EditorialPageDefinition }) {
  if (page.faq.length === 0) return null;
  const english = page.locale === "en";

  return (
    <section className="border-y border-border/60 bg-muted/15 py-12 sm:py-16" aria-labelledby={`faq-${page.path}`}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="mx-auto mb-7 max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-wider text-primary">FAQ</p>
          <h2 id={`faq-${page.path}`} className="mt-2 text-3xl font-black tracking-tight">
            {english ? "Frequently asked questions" : "Perguntas frequentes"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {english
              ? "Direct answers based on the visible, reviewed content of this page."
              : "Respostas diretas baseadas no conteúdo visível e revisado desta página."}
          </p>
        </div>
        <div className="space-y-3">
          {page.faq.map((faq) => (
            <details key={faq.question} className="group rounded-xl border border-border bg-card px-4 py-4 open:border-primary/40 sm:px-5">
              <summary className="cursor-pointer list-none pr-6 font-bold marker:hidden">
                {faq.question}
              </summary>
              <p className="mt-3 border-t border-border/70 pt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditorialReferences({ page }: { page: EditorialPageDefinition }) {
  if (!page.references?.length) return null;
  const english = page.locale === "en";

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby={`references-${page.path}`}>
      <div className="flex items-start gap-3">
        <Scale className="mt-1 h-7 w-7 shrink-0 text-primary" />
        <div>
          <h2 id={`references-${page.path}`} className="text-3xl font-black tracking-tight">
            {english ? "Research references" : "Referências de pesquisa"}
          </h2>
          <p className="mt-3 max-w-4xl leading-7 text-muted-foreground">
            {english
              ? "These publications study general learning principles. None of them directly evaluated APE as a product."
              : "Estas publicações estudam princípios gerais de aprendizagem. Nenhuma delas avaliou diretamente o APE como produto."}
          </p>
        </div>
      </div>
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
  );
}

function EditorialRelatedLinks({ page }: { page: EditorialPageDefinition }) {
  if (page.relatedLinks.length === 0) return null;
  const english = page.locale === "en";

  return (
    <nav className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6" aria-label={english ? "Related pages" : "Páginas relacionadas"}>
      <Card>
        <CardContent className="p-5 sm:p-7">
          <h2 className="text-2xl font-black">{english ? "Continue exploring" : "Continue explorando"}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {english
              ? "These pages deepen the product, methodology and public-content information."
              : "Estas páginas aprofundam informações sobre o produto, a metodologia e o conteúdo público."}
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {page.relatedLinks.map((link) => (
              <li key={`${link.href}:${link.label}`}>
                {linkElement(
                  link.href,
                  <>
                    <span>{getEditorialRouteLabel(link.href, page.locale)}</span>
                    {/^(https?:)?\/\//i.test(link.href)
                      ? <ExternalLink className="h-4 w-4 shrink-0" />
                      : <ArrowRight className="h-4 w-4 shrink-0" />}
                  </>,
                  "flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 font-bold transition hover:border-primary/50 hover:text-primary",
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </nav>
  );
}

export function EditorialContent({ page, compact = false, includeAuthor = true }: EditorialContentProps) {
  return (
    <>
      <section className={compact ? "mx-auto w-full max-w-5xl px-4 py-10 sm:px-6" : "mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16"}>
        <EditorialHighlights page={page} />
        <div className={page.highlights.length > 0 ? "mt-8" : ""}>
          <EditorialSections page={page} />
        </div>
      </section>
      <EditorialFaq page={page} />
      <EditorialReferences page={page} />
      {includeAuthor && (
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <EditorialAuthorCard page={page} />
        </section>
      )}
      <EditorialRelatedLinks page={page} />
    </>
  );
}

export function EditorialPage({ path, afterHero, includeLandingStickyCta = false }: EditorialPageProps) {
  const page = requireEditorialPage(path);
  const english = page.locale === "en";
  const pairedRoute = getPairedEditorialRoute(page.path);
  const secondaryHref = getEditorialSecondaryHref(page);
  const structuredData = buildEditorialStructuredData(page);
  const alternates = pairedRoute
    ? [
        { hrefLang: page.locale, href: page.path },
        { hrefLang: english ? "pt-BR" : "en", href: pairedRoute },
        { hrefLang: "x-default", href: page.path === "/" ? "/" : english ? pairedRoute : page.path },
      ]
    : page.path === "/"
      ? [
          { hrefLang: "pt-BR", href: "/" },
          { hrefLang: "en", href: "/en" },
          { hrefLang: "x-default", href: "/" },
        ]
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEOHead
        title={page.title}
        description={page.description}
        path={page.path}
        canonicalPath={page.path}
        language={page.locale}
        imageAlt={english ? "APE editorial public page" : "Página editorial pública do APE"}
        alternates={alternates}
        jsonLd={structuredData}
        ogType={page.schema.includes("Article") ? "article" : "website"}
      />
      <PublicNav />
      {page.path !== "/" && <PublicBackBar />}

      <main>
        <section className="relative overflow-hidden border-b border-border/50">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 -top-32 h-[380px] w-[380px] rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -right-32 h-[430px] w-[430px] rounded-full bg-accent/15 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:py-20">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  APE — App Piteco
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  {page.audience}
                </Badge>
              </div>
              <h1 className="mt-5 text-balance text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {page.h1}
              </h1>
              <div className="mx-auto mt-6 max-w-4xl space-y-4">
                {page.intro.map((paragraph) => (
                  <p key={paragraph} className="text-[1.05rem] leading-8 text-muted-foreground sm:text-xl sm:leading-9">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <AuthAwareCTA guestMode="signup" size="lg" className="min-h-12 gap-2 px-6 text-base font-bold">
                  {page.cta.primary}
                  <ArrowRight className="h-4 w-4" />
                </AuthAwareCTA>
                <Button asChild size="lg" variant="outline" className="min-h-12 px-6 text-base font-bold">
                  <Link to={secondaryHref}>{page.cta.secondary}</Link>
                </Button>
                {pairedRoute && (
                  <Button asChild size="lg" variant="ghost" className="min-h-12 px-5">
                    <Link to={pairedRoute}>
                      <Languages className="mr-2 h-4 w-4" />
                      {english ? "Português" : "English"}
                    </Link>
                  </Button>
                )}
              </div>
              <p className="mt-5 text-xs leading-6 text-muted-foreground">
                {english ? "Published" : "Publicada em"} {formatDate(page.datePublished, page.locale)} · {english ? "last reviewed" : "última revisão"} {formatDate(page.dateModified, page.locale)}
              </p>
            </div>
          </div>
        </section>

        {afterHero}
        <EditorialContent page={page} />
      </main>

      <PublicFooter />
      {includeLandingStickyCta && <LandingStickyCTA />}
    </div>
  );
}

export default EditorialPage;
