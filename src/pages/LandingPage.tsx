import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SmartCTA } from "@/components/cta/SmartCTA";
import { LandingStickyCTA } from "@/components/cta/LandingStickyCTA";
import { Card, CardContent } from "@/components/ui/card";
import {
  ListChecks, FolderTree, Sparkles, ArrowRight, Gamepad2, Users,
  Layers, TrendingUp, Check, PenLine, ListOrdered, Shuffle, Mic
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

/**
 * Demonstração visual dos modos de prática.
 * Apenas conteúdo estático — não toca nos jogos reais.
 */
const PRACTICE_MODES = [
  {
    icon: Layers,
    title: "Flashcards",
    text: "Vire o card, ouça o áudio e marque acertos.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inglês</div>
        <div className="text-lg font-bold">to practice</div>
        <div className="mt-2 text-xs text-muted-foreground">↺ Tocar para virar</div>
      </div>
    ),
  },
  {
    icon: PenLine,
    title: "Escrita",
    text: "Digite a tradução e fixe a escrita correta.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Traduza</div>
        <div className="text-sm font-medium mb-2">to practice</div>
        <div className="h-7 rounded-md border border-primary/40 bg-muted/40 px-2 flex items-center text-xs text-foreground">
          pratic<span className="ml-px inline-block w-px h-3 bg-foreground animate-pulse" />
        </div>
      </div>
    ),
  },
  {
    icon: ListOrdered,
    title: "Múltipla escolha",
    text: "Escolha a opção correta entre quatro.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">to practice</div>
        {["praticar", "estudar", "treinar", "lembrar"].map((opt, i) => (
          <div
            key={opt}
            className={`text-xs px-2 py-1 rounded border ${i === 0 ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
          >
            {opt}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Shuffle,
    title: "Organizar palavras",
    text: "Reordene os termos para formar a frase.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Monte a frase</div>
        <div className="flex flex-wrap gap-1">
          {["I", "want", "to", "practice", "english"].map((w) => (
            <span key={w} className="text-xs px-2 py-1 rounded bg-muted border border-border">{w}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Mic,
    title: "Pronúncia",
    text: "Ouça o áudio nativo e repita em voz alta.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Áudio</div>
        <div className="text-sm font-medium mb-2">to practice</div>
        <div className="flex items-end gap-0.5 h-6">
          {[3, 6, 4, 8, 5, 7, 3, 9, 5, 4, 7, 3].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-sm bg-gradient-to-t from-primary to-primary-glow"
              style={{ height: `${h * 10}%` }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: TrendingUp,
    title: "Progresso",
    text: "Acompanhe metas, sequência e revisão ativa.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          <span>Meta semanal</span><span className="text-primary">68%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
          <div className="h-full w-2/3 bg-gradient-to-r from-primary to-primary-glow" />
        </div>
        <div className="text-xs text-muted-foreground">Sequência: 5 dias 🔥</div>
      </div>
    ),
  },
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
                Crie listas, pratique com jogos e transforme vocabulário em uso real —
                feito para alunos e professores.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <SmartCTA
                  destination="app"
                  placement="hero"
                  size="lg"
                  className="gap-2"
                  label={<>Começar a estudar agora <ArrowRight className="h-4 w-4" /></>}
                  authedLabel={<>Abrir meu painel <ArrowRight className="h-4 w-4" /></>}
                />
                <SmartCTA
                  destination="public"
                  to="/portal"
                  placement="hero"
                  size="lg"
                  variant="outline"
                  label="Ver uma atividade"
                />
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
            <Card key={title} className="h-full interactive-card">
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

      {/* MODOS DE PRÁTICA — demonstração visual estática */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">Modos de prática</h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
          Diferentes formas de praticar a mesma palavra — fixação real, do reconhecimento à produção.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRACTICE_MODES.map(({ icon: Icon, title, text, preview }) => (
            <Card key={title} className="h-full interactive-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{text}</p>
                {preview}
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
            <Link key={to} to={to} className="group block pressable">
              <Card className="h-full interactive-card group-hover:border-primary/50">
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
        <SmartCTA
          destination="app"
          placement="section"
          size="lg"
          label="Criar acesso"
          authedLabel="Continuar estudando"
        />
      </section>

      <PublicFooter />
      <LandingStickyCTA />
    </div>
  );
}