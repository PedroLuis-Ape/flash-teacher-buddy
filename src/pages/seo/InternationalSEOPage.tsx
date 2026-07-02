import { Link, useLocation } from "react-router-dom";
import { Languages, ArrowRight, BookOpen, GraduationCap, Layers, Volume2 } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { PublicThemeToggle } from "@/components/seo/PublicThemeToggle";

const SITE_URL = "https://www.apeeducation.org";

type Locale = "pt-BR" | "en";

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type PageDefinition = {
  locale: Locale;
  path: string;
  pairPath: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  schemaType: "WebPage" | "AboutPage" | "LearningResource";
  sections: Section[];
};

const pages: Record<string, PageDefinition> = {
  "/pt-br": {
    locale: "pt-BR",
    path: "/pt-br",
    pairPath: "/en",
    title: "APE em Português — Flashcards, Áudio e Prática Ativa",
    description: "Conheça o APE em português: flashcards, áudio, jogos e organização de materiais para alunos e professores.",
    h1: "Inglês com flashcards, áudio e prática ativa",
    intro: "O APE transforma palavras e frases em atividades reutilizáveis para estudar, ensinar e revisar em sessões curtas.",
    schemaType: "WebPage",
    sections: [
      { title: "Prática que usa o mesmo conteúdo de vários jeitos", paragraphs: ["Uma lista pode alimentar flashcards, escrita, múltipla escolha, organização de frases e revisão direcionada.", "O aluno muda a atividade sem perder o contexto do material criado pelo professor."] },
      { title: "Para alunos e professores", items: ["Materiais organizados em pastas e listas.", "Áudio baseado no idioma estudado.", "Turmas, compartilhamento e portal público.", "Importação estruturada de conteúdo."] },
    ],
  },
  "/pt-br/recursos": {
    locale: "pt-BR",
    path: "/pt-br/recursos",
    pairPath: "/en/features",
    title: "Recursos do APE para Estudo Ativo",
    description: "Veja os recursos do APE para criar flashcards, praticar escrita, ouvir conteúdo e organizar materiais de estudo.",
    h1: "Recursos para transformar conteúdo em prática",
    intro: "Crie uma base de conteúdo e reutilize-a em atividades diferentes, com áudio, contexto e acompanhamento.",
    schemaType: "WebPage",
    sections: [
      { title: "Criação e organização", items: ["Pastas e listas.", "Importação estruturada.", "Cards normais e em camadas.", "Glossário centralizado."] },
      { title: "Modos de estudo", items: ["Flashcards.", "Escrita.", "Múltipla escolha.", "Organização de frases.", "Revisão do conteúdo difícil."] },
    ],
  },
  "/pt-br/flashcards": {
    locale: "pt-BR",
    path: "/pt-br/flashcards",
    pairPath: "/en/flashcards",
    title: "Flashcards de Inglês com Áudio e Contexto | APE",
    description: "Use flashcards de inglês com tradução, áudio, exemplos, camadas de significado e prática ativa.",
    h1: "Flashcards que vão além de virar cartões",
    intro: "Cada card pode reunir tradução, áudio, exemplo, explicação e diferentes sentidos relacionados.",
    schemaType: "LearningResource",
    sections: [
      { title: "Recuperação ativa", paragraphs: ["Tente lembrar antes de revelar a resposta e alterne reconhecimento com produção escrita."] },
      { title: "Camadas de significado", paragraphs: ["Um mesmo termo pode agrupar sentidos relacionados sem virar uma sequência de cards soltos."] },
    ],
  },
  "/pt-br/para-professores": {
    locale: "pt-BR",
    path: "/pt-br/para-professores",
    pairPath: "/en/for-teachers",
    title: "APE para Professores — Materiais, Turmas e Flashcards",
    description: "Organize materiais, importe listas, acompanhe turmas e publique conteúdos com o APE.",
    h1: "Ferramentas para professores organizarem prática ativa",
    intro: "O mesmo material pode ser usado em aula, tarefa, revisão e estudo autônomo.",
    schemaType: "WebPage",
    sections: [
      { title: "Fluxo de conteúdo", items: ["Criar ou importar.", "Organizar por pasta e lista.", "Aplicar em atividades.", "Compartilhar com turma ou portal público."] },
      { title: "Privacidade por padrão", paragraphs: ["Materiais privados, progresso individual e dados de alunos permanecem fora das páginas públicas."] },
    ],
  },
  "/pt-br/sobre": {
    locale: "pt-BR",
    path: "/pt-br/sobre",
    pairPath: "/en/about",
    title: "Sobre o APE — Apprentice Practice & Enhancement",
    description: "Conheça o propósito, a autoria e a metodologia do APE, também conhecido como App Piteco.",
    h1: "Sobre o APE — App Piteco",
    intro: "APE significa Apprentice Practice & Enhancement, uma plataforma criada para aproximar organização de conteúdo e prática real.",
    schemaType: "AboutPage",
    sections: [
      { title: "Propósito", paragraphs: ["O projeto foi criado por Pedro Luis de Oliveira Silva para reunir criação de materiais, estudo ativo e organização pedagógica."] },
      { title: "Metodologia", paragraphs: ["O foco é reutilizar o mesmo conteúdo em tarefas diferentes para desenvolver reconhecimento, recuperação e produção."] },
    ],
  },
  "/en": {
    locale: "en",
    path: "/en",
    pairPath: "/pt-br",
    title: "APE in English — Flashcards, Audio and Active Practice",
    description: "Discover APE in English: flashcards, audio, games and study-material organization for students and teachers.",
    h1: "Active language practice with flashcards and audio",
    intro: "APE turns words and sentences into reusable activities for learning, teaching and reviewing in short sessions.",
    schemaType: "WebPage",
    sections: [
      { title: "One content base, multiple activities", paragraphs: ["A single list can power flashcards, writing, multiple choice, sentence ordering and targeted review.", "Learners can change the activity without losing the context prepared by the teacher."] },
      { title: "For learners and teachers", items: ["Folders and study lists.", "Audio based on the learning language.", "Classes, sharing and a public portal.", "Structured content import."] },
    ],
  },
  "/en/features": {
    locale: "en",
    path: "/en/features",
    pairPath: "/pt-br/recursos",
    title: "APE Features for Active Learning",
    description: "Explore APE features for creating flashcards, practising writing, listening to content and organizing study materials.",
    h1: "Features that turn content into practice",
    intro: "Build a content base and reuse it across different activities with audio, context and progress tracking.",
    schemaType: "WebPage",
    sections: [
      { title: "Creation and organization", items: ["Folders and lists.", "Structured import.", "Normal and layered cards.", "Centralized glossary."] },
      { title: "Study modes", items: ["Flashcards.", "Writing.", "Multiple choice.", "Sentence ordering.", "Difficult-content review."] },
    ],
  },
  "/en/flashcards": {
    locale: "en",
    path: "/en/flashcards",
    pairPath: "/pt-br/flashcards",
    title: "Language Flashcards with Audio and Context | APE",
    description: "Use language flashcards with translations, audio, examples, meaning layers and active practice.",
    h1: "Flashcards that do more than flip",
    intro: "Each card can combine a translation, audio, examples, explanations and related meanings.",
    schemaType: "LearningResource",
    sections: [
      { title: "Active recall", paragraphs: ["Try to retrieve the answer before revealing it, then alternate recognition with written production."] },
      { title: "Meaning layers", paragraphs: ["One term can group related meanings without becoming a disconnected sequence of cards."] },
    ],
  },
  "/en/for-teachers": {
    locale: "en",
    path: "/en/for-teachers",
    pairPath: "/pt-br/para-professores",
    title: "APE for Teachers — Materials, Classes and Flashcards",
    description: "Organize materials, import lists, manage classes and publish learning content with APE.",
    h1: "Tools for teachers to organize active practice",
    intro: "The same material can support lessons, homework, review and independent practice.",
    schemaType: "WebPage",
    sections: [
      { title: "Content workflow", items: ["Create or import.", "Organize by folder and list.", "Use content in activities.", "Share with a class or the public portal."] },
      { title: "Private by default", paragraphs: ["Private materials, individual progress and student data remain outside public pages."] },
    ],
  },
  "/en/about": {
    locale: "en",
    path: "/en/about",
    pairPath: "/pt-br/sobre",
    title: "About APE — Apprentice Practice & Enhancement",
    description: "Learn about the purpose, authorship and learning approach behind APE, also known as App Piteco.",
    h1: "About APE — App Piteco",
    intro: "APE stands for Apprentice Practice & Enhancement, a platform built to connect content organization with real practice.",
    schemaType: "AboutPage",
    sections: [
      { title: "Purpose", paragraphs: ["The project was created by Pedro Luis de Oliveira Silva to combine material creation, active learning and pedagogical organization."] },
      { title: "Learning approach", paragraphs: ["The same content is reused across different tasks to develop recognition, retrieval and production."] },
    ],
  },
};

const navByLocale = {
  "pt-BR": [
    ["/pt-br", "Início"],
    ["/pt-br/recursos", "Recursos"],
    ["/pt-br/flashcards", "Flashcards"],
    ["/pt-br/para-professores", "Professores"],
    ["/pt-br/sobre", "Sobre"],
  ],
  en: [
    ["/en", "Home"],
    ["/en/features", "Features"],
    ["/en/flashcards", "Flashcards"],
    ["/en/for-teachers", "Teachers"],
    ["/en/about", "About"],
  ],
} satisfies Record<Locale, [string, string][]>;

function absolute(path: string) {
  return `${SITE_URL}${path}`;
}

function buildJsonLd(page: PageDefinition) {
  const canonical = absolute(page.path);
  const homePath = page.locale === "en" ? "/en" : "/pt-br";
  const homeLabel = page.locale === "en" ? "Home" : "Início";
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "APE Education",
      alternateName: ["APE", "App Piteco"],
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/branding/icon.png` },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "APE — Apprentice Practice & Enhancement",
      url: `${SITE_URL}/`,
      inLanguage: ["pt-BR", "en"],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ];

  if (page.path !== homePath) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: homeLabel, item: absolute(homePath) },
        { "@type": "ListItem", position: 2, name: page.h1, item: canonical },
      ],
    });
  }

  graph.push({
    "@type": page.schemaType === "LearningResource" ? "WebPage" : page.schemaType,
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: page.h1,
    headline: page.title,
    description: page.description,
    inLanguage: page.locale,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  });

  if (page.schemaType === "LearningResource") {
    graph.push({
      "@type": "LearningResource",
      "@id": `${canonical}#learning-resource`,
      name: page.h1,
      description: page.description,
      url: canonical,
      inLanguage: page.locale,
      provider: { "@id": `${SITE_URL}/#organization` },
      mainEntityOfPage: { "@id": `${canonical}#webpage` },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export default function InternationalSEOPage() {
  const location = useLocation();
  const normalizedPath = location.pathname.length > 1
    ? location.pathname.replace(/\/$/, "")
    : location.pathname;
  const page = pages[normalizedPath] ?? pages["/en"];
  const english = page.locale === "en";
  const homePath = english ? "/en" : "/pt-br";
  const primaryLabel = english ? "Start learning" : "Começar a estudar";
  const portalLabel = english ? "Explore features" : "Explorar recursos";
  const portalPath = english ? "/en/features" : "/pt-br/recursos";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={page.title}
        description={page.description}
        path={page.path}
        language={page.locale}
        imageAlt={english ? "APE active-learning platform" : "APE — plataforma de estudo ativo"}
        alternates={[
          { hrefLang: page.locale, href: page.path },
          { hrefLang: page.locale === "en" ? "pt-BR" : "en", href: page.pairPath },
          { hrefLang: "x-default", href: "/" },
        ]}
        jsonLd={buildJsonLd(page)}
      />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 lg:px-6">
          <Link to={homePath} className="flex items-center gap-2 font-bold">
            <PitecoLogo className="h-8 w-8" />
            <span>APE</span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 text-sm lg:flex">
            {navByLocale[page.locale].map(([to, label]) => (
              <Link key={to} to={to} className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={page.pairPath} hrefLang={page.locale === "en" ? "pt-BR" : "en"}>
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
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-20">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {english ? "Active learning platform" : "Plataforma de estudo ativo"}
              </p>
              <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl lg:text-6xl">
                {page.h1}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <AuthAwareCTA guestMode="signup" size="lg">{primaryLabel}</AuthAwareCTA>
                <Button asChild size="lg" variant="outline">
                  <Link to={portalPath}>{portalLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 shadow-xl">
              <CardContent className="space-y-5 p-7">
                <div className="flex items-center gap-3"><Layers className="h-6 w-6 text-primary" /><span className="font-semibold">Flashcards</span></div>
                <div className="flex items-center gap-3"><Volume2 className="h-6 w-6 text-primary" /><span className="font-semibold">{english ? "Localized audio" : "Áudio localizado"}</span></div>
                <div className="flex items-center gap-3"><BookOpen className="h-6 w-6 text-primary" /><span className="font-semibold">{english ? "Reusable activities" : "Atividades reutilizáveis"}</span></div>
                <div className="flex items-center gap-3"><GraduationCap className="h-6 w-6 text-primary" /><span className="font-semibold">{english ? "Students and teachers" : "Alunos e professores"}</span></div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-12 md:px-6">
          {page.sections.map((section) => (
            <Card key={section.title} className="interactive-card">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-2xl font-bold md:text-3xl">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 leading-relaxed text-muted-foreground">{paragraph}</p>
                ))}
                {section.items && (
                  <ul className="mt-4 grid gap-2 text-muted-foreground sm:grid-cols-2">
                    {section.items.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} APE — Apprentice Practice & Enhancement</p>
          <div className="flex gap-4">
            <Link to={english ? "/en/about" : "/pt-br/sobre"}>{english ? "About" : "Sobre"}</Link>
            <Link to="/portal">Portal</Link>
            <Link to="/auth">{english ? "Sign in" : "Entrar"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
