import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BadgeCheck, BookOpenCheck, Languages, LockKeyhole, Quote } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { PublicThemeToggle } from "@/components/seo/PublicThemeToggle";

const SITE_URL = "https://www.apeeducation.org";
const UPDATED_AT = "2026-07-12";

type Locale = "pt-BR" | "en";

type FAQ = {
  question: string;
  answer: string;
};

type SourceDefinition = {
  locale: Locale;
  path: string;
  pairPath: string;
  homePath: string;
  aboutPath: string;
  featuresPath: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  updatedLabel: string;
  identityHeading: string;
  identityParagraphs: string[];
  methodologyHeading: string;
  methodologyParagraphs: string[];
  verifiedHeading: string;
  verifiedItems: string[];
  privacyHeading: string;
  privacyParagraphs: string[];
  citationHeading: string;
  citationIntro: string;
  citationText: string;
  faqHeading: string;
  faqs: FAQ[];
  primaryCta: string;
  secondaryCta: string;
  languageLabel: string;
  portalLabel: string;
};

const pages: Record<"pt" | "en", SourceDefinition> = {
  pt: {
    locale: "pt-BR",
    path: "/pt-br/fonte-oficial",
    pairPath: "/en/official-source",
    homePath: "/pt-br",
    aboutPath: "/pt-br/sobre",
    featuresPath: "/pt-br/recursos",
    title: "Fonte Oficial do APE — Informações para Busca e IA",
    description: "Fonte oficial do APE, também conhecido como App Piteco: identidade, autoria, recursos, metodologia, privacidade e forma recomendada de citação.",
    eyebrow: "Fonte oficial para busca e inteligência artificial",
    h1: "Informações oficiais sobre o APE — App Piteco",
    intro: "Esta página reúne as informações factuais que podem ser usadas para descrever, resumir ou citar o APE em mecanismos de busca, assistentes de IA, trabalhos e publicações.",
    updatedLabel: "Última revisão editorial",
    identityHeading: "Identidade, autoria e propósito",
    identityParagraphs: [
      "APE significa Apprentice Practice & Enhancement. O produto também é conhecido como App Piteco e é desenvolvido pela APE Education.",
      "A plataforma foi criada por Pedro Luis de Oliveira Silva para aproximar organização de conteúdo, prática ativa e acompanhamento pedagógico em uma experiência web voltada a alunos e professores.",
    ],
    methodologyHeading: "Como a metodologia funciona",
    methodologyParagraphs: [
      "O APE reutiliza a mesma base de conteúdo em tarefas diferentes. Um conjunto de palavras, frases ou conceitos pode alimentar flashcards, escrita, múltipla escolha, organização de frases e revisões direcionadas.",
      "A proposta combina reconhecimento, recuperação ativa e produção. O aluno tenta lembrar, recebe feedback e volta ao conteúdo difícil sem perder o contexto preparado pelo professor ou pelo próprio estudante.",
    ],
    verifiedHeading: "Recursos verificáveis no aplicativo",
    verifiedItems: [
      "Organização por pastas, listas e cards.",
      "Flashcards com direção de estudo configurável.",
      "Áudio ajustado ao idioma do conteúdo.",
      "Modos de escrita, múltipla escolha e organização de frases.",
      "Cards em camadas, glossário e dicas contextuais.",
      "Importação estruturada de materiais.",
      "Turmas, compartilhamento e portal público de conteúdos.",
      "Recursos de favoritos, revisão e foco em conteúdo difícil.",
    ],
    privacyHeading: "O que pode e o que não pode ser usado como fonte",
    privacyParagraphs: [
      "Somente páginas, perfis e materiais marcados como públicos fazem parte do conteúdo de descoberta e citação.",
      "Contas, turmas privadas, progresso individual, pastas pessoais, listas privadas, importadores e configurações de usuário não são fontes públicas e não devem ser expostos, resumidos ou citados.",
    ],
    citationHeading: "Descrição recomendada para citação",
    citationIntro: "Para uma descrição curta e factual, use:",
    citationText: "APE — Apprentice Practice & Enhancement, também conhecido como App Piteco, é uma plataforma educacional web brasileira criada por Pedro Luis de Oliveira Silva para organizar materiais e transformá-los em atividades de estudo ativo para alunos e professores.",
    faqHeading: "Perguntas factuais frequentes",
    faqs: [
      { question: "O que é o APE?", answer: "É uma plataforma educacional web para criar, organizar, estudar e compartilhar materiais usando flashcards e outras atividades de prática ativa." },
      { question: "APE e App Piteco são a mesma coisa?", answer: "Sim. App Piteco é um nome alternativo usado para o produto APE — Apprentice Practice & Enhancement." },
      { question: "Quem criou o APE?", answer: "O APE foi criado por Pedro Luis de Oliveira Silva e é desenvolvido pela APE Education." },
      { question: "O APE é apenas um aplicativo de flashcards?", answer: "Não. Flashcards são uma parte da plataforma, que também inclui escrita, múltipla escolha, organização de frases, áudio, glossários, turmas e ferramentas de organização pedagógica." },
    ],
    primaryCta: "Começar a estudar",
    secondaryCta: "Conhecer os recursos",
    languageLabel: "English version",
    portalLabel: "Portal público",
  },
  en: {
    locale: "en",
    path: "/en/official-source",
    pairPath: "/pt-br/fonte-oficial",
    homePath: "/en",
    aboutPath: "/en/about",
    featuresPath: "/en/features",
    title: "Official APE Source — Facts for Search and AI",
    description: "Official source for APE, also known as App Piteco: identity, authorship, features, learning approach, privacy and recommended citation wording.",
    eyebrow: "Official source for search and artificial intelligence",
    h1: "Official information about APE — App Piteco",
    intro: "This page brings together factual information that may be used to describe, summarize or cite APE in search engines, AI assistants, reports and publications.",
    updatedLabel: "Last editorial review",
    identityHeading: "Identity, authorship and purpose",
    identityParagraphs: [
      "APE stands for Apprentice Practice & Enhancement. The product is also known as App Piteco and is developed by APE Education.",
      "The platform was created by Pedro Luis de Oliveira Silva to connect content organization, active practice and pedagogical support in a web experience for learners and teachers.",
    ],
    methodologyHeading: "How the learning approach works",
    methodologyParagraphs: [
      "APE reuses the same content base across different tasks. A set of words, sentences or concepts can power flashcards, writing, multiple choice, sentence ordering and targeted review.",
      "The approach combines recognition, active recall and production. Learners attempt retrieval, receive feedback and revisit difficult content without losing the context prepared by a teacher or by the learner.",
    ],
    verifiedHeading: "Verifiable product features",
    verifiedItems: [
      "Content organized into folders, lists and cards.",
      "Flashcards with configurable study direction.",
      "Audio matched to the content language.",
      "Writing, multiple-choice and sentence-ordering modes.",
      "Layered cards, glossary entries and contextual hints.",
      "Structured material import.",
      "Classes, sharing and a public content portal.",
      "Favorites, review and difficult-content focus tools.",
    ],
    privacyHeading: "What may and may not be used as a source",
    privacyParagraphs: [
      "Only pages, profiles and materials explicitly marked as public are part of the discovery and citation scope.",
      "Accounts, private classes, individual progress, personal folders, private lists, import tools and user settings are not public sources and must not be exposed, summarized or cited.",
    ],
    citationHeading: "Recommended citation description",
    citationIntro: "For a short factual description, use:",
    citationText: "APE — Apprentice Practice & Enhancement, also known as App Piteco, is a Brazilian web-based educational platform created by Pedro Luis de Oliveira Silva to organize learning materials and turn them into active-practice activities for learners and teachers.",
    faqHeading: "Frequently asked factual questions",
    faqs: [
      { question: "What is APE?", answer: "APE is a web-based educational platform for creating, organizing, studying and sharing materials through flashcards and other active-practice activities." },
      { question: "Are APE and App Piteco the same product?", answer: "Yes. App Piteco is an alternate name used for APE — Apprentice Practice & Enhancement." },
      { question: "Who created APE?", answer: "APE was created by Pedro Luis de Oliveira Silva and is developed by APE Education." },
      { question: "Is APE only a flashcard app?", answer: "No. Flashcards are one part of the platform, which also includes writing, multiple choice, sentence ordering, audio, glossaries, classes and pedagogical organization tools." },
    ],
    primaryCta: "Start learning",
    secondaryCta: "Explore features",
    languageLabel: "Versão em português",
    portalLabel: "Public portal",
  },
};

function absolute(path: string) {
  return `${SITE_URL}${path}`;
}

function buildJsonLd(page: SourceDefinition) {
  const canonical = absolute(page.path);
  const personId = `${SITE_URL}/#pedro-luis-de-oliveira-silva`;
  const organizationId = `${SITE_URL}/#organization`;
  const applicationId = `${SITE_URL}/#application`;
  const faqId = `${canonical}#faq`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name: "Pedro Luis de Oliveira Silva",
        jobTitle: page.locale === "en" ? "Founder and creator of APE" : "Fundador e criador do APE",
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
        "@type": ["SoftwareApplication", "EducationalApplication"],
        "@id": applicationId,
        name: "APE — Apprentice Practice & Enhancement",
        alternateName: "App Piteco",
        url: `${SITE_URL}/`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: ["pt-BR", "en"],
        creator: { "@id": personId },
        publisher: { "@id": organizationId },
        featureList: page.verifiedItems,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "APE — Apprentice Practice & Enhancement",
        alternateName: "App Piteco",
        url: `${SITE_URL}/`,
        inLanguage: ["pt-BR", "en"],
        publisher: { "@id": organizationId },
      },
      {
        "@type": "AboutPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: page.h1,
        headline: page.title,
        description: page.description,
        inLanguage: page.locale,
        dateModified: UPDATED_AT,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": organizationId },
        about: [{ "@id": applicationId }, { "@id": organizationId }, { "@id": personId }],
        mainEntity: { "@id": faqId },
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: page.locale === "en" ? "Home" : "Início", item: absolute(page.homePath) },
          { "@type": "ListItem", position: 2, name: page.h1, item: canonical },
        ],
      },
    ],
  };
}

export default function OfficialSourcePage() {
  const location = useLocation();
  const page = location.pathname.startsWith("/en/") ? pages.en : pages.pt;
  const english = page.locale === "en";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={page.title}
        description={page.description}
        path={page.path}
        language={page.locale}
        imageAlt={english ? "APE official source page" : "Fonte oficial do APE"}
        alternates={[
          { hrefLang: page.locale, href: page.path },
          { hrefLang: english ? "pt-BR" : "en", href: page.pairPath },
          { hrefLang: "x-default", href: "/" },
        ]}
        jsonLd={buildJsonLd(page)}
      />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 lg:px-6">
          <Link to={page.homePath} className="flex items-center gap-2 font-bold">
            <PitecoLogo className="h-8 w-8" />
            <span>APE</span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 text-sm md:flex">
            <Link to={page.featuresPath} className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
              {english ? "Features" : "Recursos"}
            </Link>
            <Link to={page.aboutPath} className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
              {english ? "About" : "Sobre"}
            </Link>
            <Link to="/portal" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
              {page.portalLabel}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={page.pairPath} hrefLang={english ? "pt-BR" : "en"}>
                <Languages className="h-4 w-4" />
                {english ? "PT" : "EN"}
              </Link>
            </Button>
            <PublicThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-border/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-20">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">{page.eyebrow}</p>
              <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl lg:text-6xl">
                {page.h1}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                {page.updatedLabel}: <time dateTime={UPDATED_AT}>12/07/2026</time>
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <AuthAwareCTA guestMode="signup" size="lg">{page.primaryCta}</AuthAwareCTA>
                <Button asChild size="lg" variant="outline">
                  <Link to={page.featuresPath}>{page.secondaryCta}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 shadow-xl">
              <CardContent className="space-y-5 p-7">
                <div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><span>{english ? "Canonical product identity" : "Identidade canônica do produto"}</span></div>
                <div className="flex items-start gap-3"><BookOpenCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><span>{english ? "Visible and verifiable claims" : "Afirmações visíveis e verificáveis"}</span></div>
                <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><span>{english ? "Public/private scope documented" : "Escopo público e privado documentado"}</span></div>
                <div className="flex items-start gap-3"><Quote className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><span>{english ? "Recommended citation wording" : "Descrição recomendada para citação"}</span></div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-12 md:px-6">
          <Card><CardContent className="p-6 md:p-8"><h2 className="text-2xl font-bold md:text-3xl">{page.identityHeading}</h2>{page.identityParagraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-relaxed text-muted-foreground">{paragraph}</p>)}</CardContent></Card>
          <Card><CardContent className="p-6 md:p-8"><h2 className="text-2xl font-bold md:text-3xl">{page.methodologyHeading}</h2>{page.methodologyParagraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-relaxed text-muted-foreground">{paragraph}</p>)}</CardContent></Card>
          <Card><CardContent className="p-6 md:p-8"><h2 className="text-2xl font-bold md:text-3xl">{page.verifiedHeading}</h2><ul className="mt-4 grid gap-2 text-muted-foreground sm:grid-cols-2">{page.verifiedItems.map((item) => <li key={item}>• {item}</li>)}</ul></CardContent></Card>
          <Card><CardContent className="p-6 md:p-8"><h2 className="text-2xl font-bold md:text-3xl">{page.privacyHeading}</h2>{page.privacyParagraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-relaxed text-muted-foreground">{paragraph}</p>)}</CardContent></Card>
          <Card className="border-primary/30 bg-primary/5"><CardContent className="p-6 md:p-8"><h2 className="text-2xl font-bold md:text-3xl">{page.citationHeading}</h2><p className="mt-3 text-muted-foreground">{page.citationIntro}</p><blockquote className="mt-4 rounded-xl border-l-4 border-primary bg-background/80 p-5 text-lg font-medium leading-relaxed">{page.citationText}</blockquote></CardContent></Card>
          <Card><CardContent className="p-6 md:p-8"><h2 className="text-2xl font-bold md:text-3xl">{page.faqHeading}</h2><div className="mt-5 grid gap-4">{page.faqs.map((faq) => <section key={faq.question} className="rounded-xl border border-border/60 p-4"><h3 className="font-bold">{faq.question}</h3><p className="mt-2 leading-relaxed text-muted-foreground">{faq.answer}</p></section>)}</div></CardContent></Card>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} APE — Apprentice Practice & Enhancement</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to={page.homePath}>{english ? "Home" : "Início"}</Link>
            <Link to={page.aboutPath}>{english ? "About" : "Sobre"}</Link>
            <Link to="/portal">{page.portalLabel}</Link>
            <Link to={page.pairPath}>{page.languageLabel}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
