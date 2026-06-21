import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SmartCTA } from "@/components/cta/SmartCTA";
import { LandingStickyCTA } from "@/components/cta/LandingStickyCTA";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface FeaturedTeacher {
  display_name: string;
  avatar_url: string | null;
  public_slug: string;
  public_bio: string | null;
}

const PILLARS = [
  { icon: FolderTree, title: "Crie listas", text: "Vocabulário e frases organizados." },
  { icon: Layers, title: "Use flashcards", text: "Áudio, dicas e revisão rápida." },
  { icon: Gamepad2, title: "Pratique jogando", text: "Escrita, escolha e tradução." },
  { icon: TrendingUp, title: "Veja o progresso", text: "Metas, histórico e lista vermelha." },
];

const EXPLORE = [
  { to: "/ingles-para-iniciantes", title: "Inglês para iniciantes", text: "Vocabulário e prática guiada." },
  { to: "/atividades-de-ingles", title: "Atividades de inglês", text: "Tradução, frases e gramática." },
  { to: "/flashcards-de-ingles", title: "Flashcards de inglês", text: "Memorização e revisão ativa." },
  { to: "/para-professores", title: "Para professores", text: "Materiais, listas e turmas." },
];

const PRACTICE_MODES = [
  { icon: Layers, title: "Flashcards", text: "Vire, ouça e revise.", preview: "↺ Toque para virar" },
  { icon: PenLine, title: "Escrita", text: "Digite e confira na hora.", preview: "pratic___" },
  { icon: ListOrdered, title: "Múltipla escolha", text: "Escolha a resposta correta.", preview: "4 alternativas" },
  { icon: Shuffle, title: "Organizar frase", text: "Monte a frase completa.", preview: "I · want · to · practice" },
  { icon: Mic, title: "Pronúncia", text: "Ouça, fale e compare.", preview: "Varia por navegador", beta: true },
  { icon: TrendingUp, title: "Progresso", text: "Acompanhe metas e revisão.", preview: "Meta semanal · 68%" },
];

const AUDIENCES = [
  {
    icon: ListChecks,
    title: "Para alunos",
    text: "Prática curta e revisão direcionada.",
    items: ["Áudio e dicas", "Lista vermelha", "Metas", "Jogos"],
    to: "/atividades-de-ingles",
    action: "Ver atividades",
  },
  {
    icon: Users,
    title: "Para professores",
    text: "Materiais, listas e turmas no mesmo lugar.",
    items: ["Importação", "Pastas", "Alunos", "Portal público"],
    to: "/para-professores",
    action: "Ver recursos",
  },
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

function SectionHeading({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <div className={compact ? "mb-4 text-left sm:mb-6 sm:text-center" : "mb-5 text-center sm:mb-7"}>
      <h2 className="text-xl font-bold sm:text-3xl md:text-4xl">{title}</h2>
      <p className="mt-1.5 text-xs text-muted-foreground sm:mx-auto sm:mt-2 sm:max-w-2xl sm:text-base">{text}</p>
    </div>
  );
}

function TeacherSpotlight({ teacher }: { teacher: FeaturedTeacher | null }) {
  const displayName = teacher?.display_name || "Professor Pedro";
  const slug = teacher?.public_slug || "pedro";

  return (
    <Link
      to={`/portal/professor/${slug}`}
      className="group mt-3 flex min-w-0 items-center gap-2.5 rounded-xl border border-primary/30 bg-card/80 p-2.5 text-left shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-card sm:mt-4 sm:max-w-xl sm:gap-3 sm:rounded-2xl sm:p-3"
      aria-label={`Ver perfil de ${displayName}`}
    >
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20 sm:h-11 sm:w-11">
        <AvatarImage src={teacher?.avatar_url ?? undefined} alt={displayName} />
        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">PP</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-[11px]">Professor recomendado</p>
        <p className="truncate text-sm font-bold">{displayName}</p>
        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
          {teacher?.public_bio || "Inglês para brasileiros · materiais e aulas"}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary sm:text-xs">
        Perfil <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function LandingPage() {
  const featuredTeacherQuery = useQuery({
    queryKey: ["landing-featured-teacher", "pedro"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_teacher_profile", { _slug: "pedro" });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as FeaturedTeacher | null;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const featuredTeacher = featuredTeacherQuery.data ?? null;

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
            className="pointer-events-none absolute -left-32 -top-32 h-[360px] w-[360px] rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary-glow)) 0%, transparent 70%)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-5 sm:px-6 sm:py-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-12 lg:py-16">
            <div className="text-center lg:text-left">
              <span className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:mb-3 sm:text-xs">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Estudo ativo de inglês
              </span>
              <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-[1.78rem] font-extrabold leading-[1.06] text-transparent sm:text-5xl lg:text-6xl">
                Inglês com flashcards, jogos e prática ativa
              </h1>
              <p className="mx-auto mt-2.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg lg:mx-0">
                Vocabulário e frases em sessões rápidas, com materiais para alunos e professores.
              </p>

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 sm:mt-6 sm:grid-cols-2 lg:max-w-xl">
                <SmartCTA
                  destination="app"
                  placement="hero"
                  size="lg"
                  className="h-10 gap-1.5 px-4 sm:h-12"
                  label={<><span className="sm:hidden">Começar</span><span className="hidden sm:inline">Começar a estudar</span><ArrowRight className="h-4 w-4" /></>}
                  authedLabel={<><span className="sm:hidden">Meu painel</span><span className="hidden sm:inline">Abrir meu painel</span><ArrowRight className="h-4 w-4" /></>}
                />
                <SmartCTA
                  destination="public"
                  to="/portal"
                  placement="hero"
                  size="lg"
                  variant="outline"
                  className="h-10 px-4 sm:h-12"
                  label={<><span className="sm:hidden">Atividades</span><span className="hidden sm:inline">Ver uma atividade</span></>}
                />
              </div>

              <TeacherSpotlight teacher={featuredTeacher} />
            </div>

            <div className="relative mx-auto hidden w-full max-w-md sm:block lg:max-w-none">
              <div className="absolute inset-2 -rotate-3 rounded-2xl border border-border bg-accent/15" aria-hidden="true" />
              <div className="absolute inset-2 rotate-2 rounded-2xl border border-border bg-primary/10" aria-hidden="true" />
              <Card className="relative overflow-hidden shadow-xl">
                <CardContent className="p-6 sm:p-7">
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Flashcard · Inglês → Português</div>
                  <div className="text-4xl font-bold">to practice</div>
                  <div className="mt-1 text-sm text-muted-foreground">/ˈpræktɪs/ · verbo</div>
                  <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
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

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
          <SectionHeading title="O que você pode fazer" text="Quatro recursos essenciais para praticar sem enrolação." compact />
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="h-full interactive-card">
                <CardContent className="p-3 sm:p-5">
                  <div className="mb-1.5 flex items-center gap-2 sm:mb-2 sm:block">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:mb-2 sm:h-10 sm:w-10 sm:rounded-xl">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <h3 className="text-[13px] font-semibold leading-tight sm:text-base">{title}</h3>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-sm">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border/40 bg-muted/15">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
            <SectionHeading title="Modos de prática" text="A mesma lista pode virar desafios diferentes." compact />
            <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {PRACTICE_MODES.map(({ icon: Icon, title, text, preview, beta }) => (
                <Card key={title} className="min-w-[68vw] snap-center sm:min-w-0 interactive-card">
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="mb-2 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9 sm:rounded-xl">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
                      {beta && (
                        <Badge className="ml-auto border-red-500 bg-red-600 px-1.5 py-0 text-[9px] font-extrabold tracking-wide text-white hover:bg-red-600">
                          BETA
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground sm:text-sm">{text}</p>
                    <div className="mt-2 rounded-md border border-border bg-background/60 px-2.5 py-2 text-[11px] text-muted-foreground sm:mt-3 sm:p-3 sm:text-xs">{preview}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground sm:hidden">Deslize para ver mais →</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
          <SectionHeading title="Feito para estudar e ensinar" text="Escolha o caminho que combina com você." compact />
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
            {AUDIENCES.map(({ icon: Icon, title, text, items, to, action }) => (
              <Card key={title} className="min-w-[82vw] snap-center sm:min-w-0">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-primary">{title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{text}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] sm:gap-2 sm:text-sm">
                    {items.map((item) => (
                      <span key={item} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {item}
                      </span>
                    ))}
                  </div>
                  <Button asChild variant="secondary" size="sm" className="mt-3 h-9 w-full sm:mt-4 sm:w-auto">
                    <Link to={to}>{action}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground sm:hidden">Deslize para alternar entre aluno e professor →</p>
        </section>

        <section className="border-y border-border/40 bg-muted/15">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
            <SectionHeading title="Explore o APE" text="Entre direto no conteúdo do seu objetivo." compact />
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {EXPLORE.map(({ to, title, text }) => (
                <Link key={to} to={to} className="group block pressable">
                  <Card className="h-full interactive-card group-hover:border-primary/50">
                    <CardContent className="p-3 sm:p-5">
                      <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:h-4 sm:w-4" />
                      </div>
                      <h3 className="text-[13px] font-semibold leading-tight group-hover:text-primary sm:text-base">{title}</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground sm:text-sm">{text}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto hidden w-full max-w-4xl px-6 py-14 text-center sm:block">
          <div className="mb-3 inline-flex items-center gap-2 text-primary">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-semibold">Comece no seu ritmo</span>
          </div>
          <h2 className="text-3xl font-bold">Menos navegação. Mais prática.</h2>
          <p className="mx-auto mt-2 max-w-xl text-base text-muted-foreground">
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
