import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, PenLine, ListChecks, FolderTree, GraduationCap,
  Globe, Sparkles, ArrowRight, Gamepad2, Users
} from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicNav, PublicFooter } from "@/components/seo/PublicNav";

const FEATURES = [
  { icon: BookOpen, title: "Flashcards de inglês", text: "Crie e revise cartões com vocabulário, frases e gramática." },
  { icon: PenLine, title: "Prática de escrita", text: "Digite a resposta para fixar a forma correta da palavra." },
  { icon: ListChecks, title: "Múltipla escolha", text: "Treine reconhecimento com alternativas inteligentes." },
  { icon: FolderTree, title: "Organização de palavras", text: "Pastas, listas e coleções para estruturar seu estudo." },
  { icon: GraduationCap, title: "Turmas e acompanhamento", text: "Professores criam turmas e acompanham o progresso dos alunos." },
  { icon: Globe, title: "Portal público de materiais", text: "Conteúdos compartilhados acessíveis sem cadastro." },
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
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24 text-center relative">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Estudo ativo de inglês
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">
            APE — Inglês com flashcards, jogos e prática ativa
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Uma plataforma de estudo criada para transformar vocabulário, frases e gramática em prática real,
            com flashcards, exercícios interativos e acompanhamento para alunos e professores.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">Começar agora <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/portal">Ver portal público</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">Como o APE ajuda no estudo</h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
          Recursos pensados para quem quer praticar inglês de forma constante, com vocabulário em inglês,
          prática de frases em inglês e revisão ativa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Para alunos</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              O aluno pode praticar vocabulário em inglês, traduzir frases, treinar escrita e revisar conteúdos
              de forma ativa. Os modos de estudo (flip, escrita e múltipla escolha) ajudam a fixar palavras
              novas com mais consistência, do nível básico ao intermediário.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>• Listas de flashcards com áudio e dicas contextuais.</li>
              <li>• Revisão dirigida de palavras difíceis (lista vermelha).</li>
              <li>• Acompanhamento de progresso e metas pessoais.</li>
            </ul>
          </div>
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Gamepad2 className="h-5 w-5" />
                <span className="font-semibold">Estudo com jogos</span>
              </div>
              <p className="text-sm text-muted-foreground">
                A proposta do APE é estudar de forma mais dinâmica, sem perder a estrutura pedagógica.
                Cada modo é desenhado para reforçar uma habilidade diferente — leitura, reconhecimento, escrita
                e tradução — em sessões curtas e focadas.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link to="/atividades-de-ingles">Ver tipos de atividades</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* PARA PROFESSORES */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 w-full">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <Card className="md:order-2">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-5 w-5" />
                <span className="font-semibold">Plataforma para professores de inglês</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Crie listas próprias, organize materiais por turma e compartilhe conteúdos de forma estruturada
                com seus alunos. Professores acompanham o progresso individual e coletivo.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link to="/para-professores">Ver recursos para professores</Link>
              </Button>
            </CardContent>
          </Card>
          <div className="md:order-1">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Para professores</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Professores podem montar listas de vocabulário, importar materiais em lote, organizar pastas por
              tema e compartilhar conteúdos públicos no portal. Um espaço pensado para aulas de inglês,
              reforço e turmas regulares.
            </p>
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