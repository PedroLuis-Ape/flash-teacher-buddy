import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SmartCTA } from "@/components/cta/SmartCTA";
import { LandingStickyCTA } from "@/components/cta/LandingStickyCTA";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  BookOpen,
  Check,
  FolderTree,
  Gamepad2,
  GraduationCap,
  Layers,
  ListChecks,
  ListOrdered,
  Mic,
  PenLine,
  Shuffle,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicNav, PublicFooter } from "@/components/seo/PublicNav";

const PILLARS = [
  { icon: FolderTree, title: "Crie listas", text: "Organize vocabulário, frases e gramática." },
  { icon: Layers, title: "Use flashcards", text: "Revise com áudio, dicas e modos de flip." },
  { icon: Gamepad2, title: "Pratique jogando", text: "Escrita, escolha e tradução ativa." },
  { icon: TrendingUp, title: "Veja o progresso", text: "Metas, lista vermelha e histórico." },
];

const EXPLORE = [
  { to: "/ingles-para-iniciantes", title: "Inglês para iniciantes", text: "Vocabulário e prática guiada." },
  { to: "/atividades-de-ingles", title: "Atividades de inglês", text: "Tradução, frases e gramática." },
  { to: "/flashcards-de-ingles", title: "Flashcards de inglês", text: "Memorização e revisão ativa." },
  { to: "/para-professores", title: "Para professores", text: "Materiais, listas e turmas." },
];

const PRACTICE_MODES = [
  { icon: Layers, title: "Flashcards", text: "Vire o card, ouça e marque acertos.", preview: "↺ Toque para virar" },
  { icon: PenLine, title: "Escrita", text: "Digite a tradução e confira na hora.", preview: "pratic___" },
  { icon: ListOrdered, title: "Múltipla escolha", text: "Escolha a alternativa correta.", preview: "4 alternativas" },
  { icon: Shuffle, title: "Organizar frase", text: "Coloque as palavras na ordem correta.", preview: "I · want · to · practice" },
  { icon: Mic, title: "Pronúncia", text: "Ouça, fale e receba uma comparação.", preview: "Compatibilidade por navegador", beta: true },
  { icon: TrendingUp, title: "Progresso", text: "Acompanhe metas e revisão ativa.", preview: "Meta semanal · 68%" },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "APE — Apprentice Practice & Enhancement",
    url: "https://www.apeeducation.org/",
    inLanguage: "pt-BR",
  },
  {
    "@context": "https://schema.org",
    "@type": "EducationalApplication",
    name: "APE — Flashcards e Estudo Ativo",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: "Plataforma de estudo de inglês com flashcards, jogos, tradução, vocabulário e prática de escrita.",
    url: "https://www.apeeducation.org/",
  },
];

function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5 text-center sm:mb-7">
      <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{text}</p>
    </div>
  );
}

function TeacherSpotlight() {
  return (
    <Link
      to="/portal/professor/pedro"
      className="group mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/80 p-3 text-left shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-card"
      aria-label="Ver perfil do Professor Pedro"
    >
      <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
        <AvatarFallback className="bg-primary/10 font-bold text-primary">PP</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">Professor Pedro</span>
          <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">Recomendado</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">Inglês para brasileiros · materiais e aulas</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
        Ver perfil <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title="APE — Inglês com Flashcards, Jogos e Prática Ativa"
        description="Estude inglês com flashcards, atividades interativas, vocabulário, frases e jogos de revisão criados para alunos e professores."
        path="/"
        jsonLd={jsonLd}
      />
      <PublicNav />

      <main>
        <section className="relative overflow-hidden border-b border-border/40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 -top-32 h-[380px] w-[380px] rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary-glow)) 0%, transparent 70%)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -right-32 h-[430px] w-[430px] rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 py-7 sm:px-6 sm:py-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-12 lg:py-16">
            <div className="text-center lg:text-left">
              <span className="mb-2 inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground sm:mb-3 sm:text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Estudo ativo de inglês
              </span>
              <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-[2rem] font-extrabold leading-[1.08] text-transparent sm:text-5xl lg:text-6xl">
                Inglês com flashcards, jogos e prática ativa
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg lg:mx-0">
                Pratique vocabulário e frases em sessões rápidas, com materiais para alunos e professores.
              </p>

              <div className="mt-5 grid gap-2.5 sm:mt-6 sm:grid-cols-2 lg:max-w-xl">
                <SmartCTA
                  destination="app"
                  placement="hero"
                  size="lg"
                  className="h-11 gap-2 sm:h-12"
                  label={<>Começar a estudar <ArrowRight className="h-4 w-4" /></>}
                  authedLabel={<>Abrir meu painel <ArrowRight className="h-4 w-4" /></>}
                />
                <SmartCTA
                  destination="public"
                  to="/portal"
                  placement="hero"
                  size="lg"
                  variant="outline"
                  className="h-11 sm:h-12"
                  label="Ver uma atividade"
                />
              </div>

              <TeacherSpotlight />
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute inset-2 -rotate-3 rounded-2xl border border-border bg-accent/15" aria-hidden="true" />
              <div className="absolute inset-2 rotate-2 rounded-2xl border border-border bg-primary/10" aria-hidden="true" />
              <Card className="relative overflow-hidden shadow-xl">
                <CardContent className="p-5 sm:p-7">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">Flashcard · Inglês → Português</div>
                  <div className="text-3xl font-bold sm:text-4xl">to practice</div>
                  <div className="mt-1 text-sm text-muted-foreground">/ˈpræktɪs/ · verbo</div>
                  <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm sm:p-4">
                    <span className="text-muted-foreground">Tradução:</span>{" "}
                    <span className="font-semibold">praticar</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-primary" /> Acertou</span>
                    <span>Card 4 / 12</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-1/3 bg-gradient-to-r from-primary to-primary-glow" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <SectionHeading title="O que o APE faz" text="Quatro recursos essenciais, sem enrolação." />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="h-full interactive-card">
                <CardContent className="p-3.5 sm:p-5">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight sm:text-base">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border/40 bg-muted/15">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
            <SectionHeading title="Modos de prática" text="A mesma lista pode virar desafios diferentes." />
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {PRACTICE_MODES.map(({ icon: Icon, title, text, preview, beta }) => (
                <Card key={title} className="min-w-[78vw] snap-center sm:min-w-0 interactive-card">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold">{title}</h3>
                      {beta && (
                        <Badge className="ml-auto border-red-500 bg-red-600 text-[10px] font-extrabold tracking-wide text-white hover:bg-red-600">
                          BETA
                        </Badge>
                      )}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{text}</p>
                    <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">{preview}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground sm:hidden">Deslize para ver os outros modos →</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <SectionHeading title="Feito para estudar e ensinar" text="Do estudo individual à organização de turmas." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <ListChecks className="h-5 w-5" />
                  <h3 className="font-bold">Para alunos</h3>
                </div>
                <p className="text-sm text-muted-foreground">Sessões curtas, revisão direcionada e progresso visível.</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {["Áudio e dicas", "Lista vermelha", "Metas pessoais", "Jogos variados"].map((item) => (
                    <span key={item} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" /> {item}
                    </span>
                  ))}
                </div>
                <Button asChild variant="secondary" size="sm" className="mt-4">
                  <Link to="/atividades-de-ingles">Ver atividades</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <Users className="h-5 w-5" />
                  <h3 className="font-bold">Para professores</h3>
                </div>
                <p className="text-sm text-muted-foreground">Materiais, listas, turmas e compartilhamento em um só lugar.</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {["Importação em lote", "Pastas por tema", "Acompanhamento", "Portal público"].map((item) => (
                    <span key={item} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" /> {item}
                    </span>
                  ))}
                </div>
                <Button asChild variant="secondary" size="sm" className="mt-4">
                  <Link to="/para-professores">Ver recursos</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-y border-border/40 bg-muted/15">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
            <SectionHeading title="Explore o APE" text="Entre direto no conteúdo que combina com seu objetivo." />
            <div className="grid grid-cols-2 gap-3">
              {EXPLORE.map(({ to, title, text }) => (
                <Link key={to} to={to} className="group block pressable">
                  <Card className="h-full interactive-card group-hover:border-primary/50">
                    <CardContent className="p-3.5 sm:p-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold leading-tight group-hover:text-primary sm:text-base">{title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{text}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <div className="mb-3 inline-flex items-center gap-2 text-primary">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-semibold">Comece no seu ritmo</span>
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">Menos navegação. Mais prática.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Crie seu acesso ou explore materiais públicos sem perder tempo.
          </p>
          <div className="mt-5 flex justify-center">
            <SmartCTA destination="app" placement="section" size="lg" label="Criar acesso" authedLabel="Continuar estudando" />
          </div>
        </section>
      </main>

      <PublicFooter />
      <LandingStickyCTA />
    </div>
  );
}
