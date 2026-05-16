import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ListChecks, FolderTree, Sparkles, ArrowRight, Gamepad2, Users,
  Layers, TrendingUp, Check
} from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicNav, PublicFooter } from "@/components/seo/PublicNav";

const PILLARS = [
  { icon: FolderTree, title: "Crie listas", text: "Organize vocabulário, frases e gramática em listas e pastas próprias." },
  { icon: Layers, title: "Estude com flashcards", text: "Revise em sessões curtas com áudio, dicas e modos de flip." },
  { icon: Gamepad2, title: "Pratique com jogos", text: "Múltipla escolha, escrita e tradução para fixar de verdade." },
  { icon: TrendingUp, title: "Acompanhe progresso", text: "Metas pessoais, lista vermelha e histórico de estudo." },
];

const EXPLORE = [
  { to: "/ingles-para-iniciantes", title: "Inglês para Iniciantes", text: "Vocabulário, frases simples e prática guiada." },
  { to: "/atividades-de-ingles", title: "Atividades de Inglês", text: "Tradução, frases, gramática e revisão ativa." },
  { to: "/flashcards-de-ingles", title: "Flashcards de Inglês", text: "Memorize vocabulário e frases com revisão ativa." },
  { to: "/para-professores", title: "Para Professores", text: "Crie listas, organize materiais e acompanhe turmas." },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "APE — Apprenticeship Practice and Enhancement",
    url: "https://www.apeeducation.org/",
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.apeeducation.org/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "APE",
    url: "https://www.apeeducation.org/",
    logo: "https://www.apeeducation.org/branding/icon.png",
  },
  {
    "@context": "https://schema.org",
    "@type": "EducationalApplication",
    name: "APE — Flashcards e Estudo Ativo",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description:
      "Plataforma de estudo de inglês com flashcards, jogos, atividades de tradução, vocabulário e prática de escrita para alunos e professores.",
    url: "https://www.apeeducation.org/",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="APE — Inglês com Flashcards, Jogos e Prática Ativa"
        description="Estude inglês com flashcards, atividades interativas, vocabulário, frases e jogos de revisão criados para alunos e professores."
        path="/"
        jsonLd={jsonLd}
      />
      <PublicNav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary-glow)) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
        />
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-20 relative">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Estudo ativo de inglês
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">
                Inglês com flashcards, jogos e prática ativa
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Crie listas, estude com flashcards e pratique com jogos. Uma plataforma para alunos
                e professores transformarem vocabulário em fluência.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/auth">Começar agora <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/portal">Ver portal público</Link>
                </Button>
              </div>
            </div>

            {/* Visual mock — flashcard preview */}
            <div className="relative max-w-md w-full mx-auto">
              <div className="absolute inset-0 -rotate-6 translate-x-4 translate-y-4 rounded-2xl bg-accent/20 border border-border" aria-hidden="true" />
              <div className="absolute inset-0 rotate-3 -translate-x-2 -translate-y-2 rounded-2xl bg-primary/10 border border-border" aria-hidden="true" />
              <Card className="relative shadow-xl">
                <CardContent className="p-8">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Flashcard · Inglês → Português</div>
                  <div className="text-3xl md:text-4xl font-bold mb-2">to practice</div>
                  <div className="text-muted-foreground mb-6">/ˈpræktɪs/ · verbo</div>
                  <div className="rounded-lg bg-muted/50 p-4 text-sm">
                    <span className="text-muted-foreground">Tradução:</span>{" "}
                    <span className="font-medium text-foreground">praticar</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-primary" /> Acertou</span>
                    <span>Card 4 / 12</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-1/3 bg-gradient-to-r from-primary to-primary-glow" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* O QUE O APE FAZ */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">O que o APE faz</h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
          Quatro pilares que sustentam a rotina de estudo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="h-full">
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* PARA ALUNOS */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-primary mb-3">
              <ListChecks className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Para alunos</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Estude com ritmo e clareza</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Pratique vocabulário, traduza frases e treine escrita em sessões curtas. Flip, escrita e
              múltipla escolha trabalham habilidades diferentes — do básico ao intermediário.
            </p>
            <Button asChild className="mt-6" variant="secondary">
              <Link to="/atividades-de-ingles">Ver tipos de atividades</Link>
            </Button>
          </div>
          <ul className="space-y-3">
            {[
              "Listas de flashcards com áudio e dicas contextuais",
              "Revisão dirigida de palavras difíceis (lista vermelha)",
              "Metas pessoais e acompanhamento de progresso",
              "Modos de estudo focados em fixação real",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PARA PROFESSORES */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <ul className="space-y-3 md:order-2">
            {[
              "Criação de listas e importação em lote",
              "Pastas organizadas por tema ou turma",
              "Turmas com acompanhamento individual",
              "Compartilhamento de materiais no portal público",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
          <div className="md:order-1">
            <div className="inline-flex items-center gap-2 text-primary mb-3">
              <Users className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Para professores</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Materiais e turmas no mesmo lugar</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Monte listas de vocabulário, organize pastas por tema e acompanhe alunos em turmas.
              Pensado para aulas regulares, reforço e estudo autônomo.
            </p>
            <Button asChild className="mt-6" variant="secondary">
              <Link to="/para-professores">Ver recursos para professores</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* EXPLORE */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">Explore o APE</h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
          Páginas dedicadas para entender como o APE pode encaixar no seu objetivo de estudo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXPLORE.map(({ to, title, text }) => (
            <Link key={to} to={to} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-16 md:py-20 text-center w-full">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          Comece a estudar com mais clareza, prática e constância.
        </h2>
        <p className="text-muted-foreground mb-8">
          Crie seu acesso e comece em poucos minutos.
        </p>
        <Button asChild size="lg">
          <Link to="/auth">Criar acesso</Link>
        </Button>
      </section>

      <PublicFooter />
    </div>
  );
}