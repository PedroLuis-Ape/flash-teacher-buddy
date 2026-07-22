import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  FolderTree,
  GraduationCap,
  Layers,
  ListChecks,
  PenLine,
  RefreshCw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SmartCTA } from "@/components/cta/SmartCTA";
import { LandingStickyCTA } from "@/components/cta/LandingStickyCTA";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicFooter, PublicNav } from "@/components/seo/PublicNav";
import { LandingProductDemo } from "@/components/landing/LandingProductDemo";
import { landingContent, landingFaqSchema } from "@/content/public/landingContent";

const STEP_ICONS = [FolderTree, Layers, PenLine, Check, RefreshCw, ListChecks];
const AUDIENCE_ICONS = [GraduationCap, Users];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "APE — Apprentice Practice & Enhancement",
    alternateName: "App Piteco",
    url: "https://www.apeeducation.org/",
    inLanguage: "pt-BR",
  },
  {
    "@context": "https://schema.org",
    "@type": "EducationalApplication",
    name: "APE — App Piteco",
    alternateName: "Apprentice Practice & Enhancement",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: landingContent.description,
    url: "https://www.apeeducation.org/",
    creator: {
      "@type": "Person",
      name: landingContent.author.name,
    },
  },
  landingFaqSchema,
];

function formattedReviewDate() {
  const [year, month, day] = landingContent.dateModified.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function SectionHeading({ eyebrow, title, text }: { eyebrow?: string; title: string; text: string }) {
  return (
    <div className="mx-auto mb-7 max-w-3xl text-center">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold sm:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{text}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead
        title={landingContent.title}
        description={landingContent.description}
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

          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_.92fr] lg:gap-12 lg:py-20">
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> {landingContent.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
                {landingContent.h1}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                {landingContent.intro}
              </p>

              <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
                <SmartCTA
                  destination="app"
                  placement="hero"
                  size="lg"
                  label={<>Começar a estudar <ArrowRight className="h-4 w-4" /></>}
                  authedLabel={<>Abrir meu painel <ArrowRight className="h-4 w-4" /></>}
                />
                <Button asChild size="lg" variant="outline">
                  <Link to="/portal">Explorar materiais públicos</Link>
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                O portal exibe somente materiais que foram explicitamente publicados.
              </p>
            </div>

            <Card className="relative overflow-hidden border-primary/25 shadow-xl">
              <CardContent className="p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Uma base de estudo</p>
                <p className="mt-2 text-3xl font-bold">to practice</p>
                <p className="mt-1 text-sm text-muted-foreground">praticar · verbo</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {["Flashcard", "Escrita", "Múltipla escolha", "Ordenação"].map((mode) => (
                    <span key={mode} className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm">
                      <Check className="h-4 w-4 text-primary" /> {mode}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                  O conteúdo permanece reconhecível enquanto a tarefa muda.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <SectionHeading
            eyebrow="Fluxo de prática"
            title="Seis passos do conteúdo à revisão"
            text="Um percurso claro para organizar, tentar, comparar e voltar ao que ainda precisa de atenção."
          />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {landingContent.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? BookOpen;
              return (
                <li key={step.title}>
                  <Card className="h-full">
                    <CardContent className="flex h-full gap-3 p-4 sm:p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-primary">Passo {index + 1}</p>
                        <h3 className="mt-0.5 font-bold">{step.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="border-y border-border/40 bg-muted/15">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 text-center sm:px-6 sm:py-14">
            <Layers className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-3 text-2xl font-bold sm:text-4xl">{landingContent.oneBase.heading}</h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {landingContent.oneBase.text}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <SectionHeading
            eyebrow="Dois pontos de vista"
            title="Feito para estudar e ensinar"
            text="A mesma estrutura apoia a prática do aluno e a organização pedagógica do professor."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {landingContent.audiences.map((audience, index) => {
              const Icon = AUDIENCE_ICONS[index] ?? UserRound;
              return (
                <Card key={audience.title} className="h-full">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-bold">{audience.title}</h3>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{audience.text}</p>
                    <ul className="mt-4 space-y-2">
                      {audience.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 shrink-0 text-primary" /> {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <LandingProductDemo demo={landingContent.demo} />

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Transparência pedagógica</p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{landingContent.methodology.heading}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {landingContent.methodology.text}
                </p>
              </div>
              <nav aria-label="Metodologia e evidências" className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                {landingContent.methodology.links.map((link) => (
                  <Button key={link.href} asChild variant="outline">
                    <Link to={link.href}>{link.label}</Link>
                  </Button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </section>

        <section className="border-y border-border/40 bg-muted/15">
          <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
            <SectionHeading
              eyebrow="Perguntas frequentes"
              title="O essencial sobre o APE"
              text="Respostas factuais compartilhadas pela página visível e pelos dados estruturados."
            />
            <div className="space-y-3">
              {landingContent.faqs.map((faq) => (
                <details key={faq.question} className="group rounded-xl border bg-card px-4 py-3 open:border-primary/35 sm:px-5">
                  <summary className="cursor-pointer list-none pr-6 font-semibold marker:hidden">
                    {faq.question}
                  </summary>
                  <p className="mt-3 border-t pt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <Card>
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Autoria e revisão</p>
                  <h2 className="mt-1 text-lg font-bold">{landingContent.author.name}</h2>
                  <p className="text-sm text-muted-foreground">{landingContent.author.role}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{landingContent.author.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Conteúdo revisado em {formattedReviewDate()}.</p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link to="/pt-br/fonte-oficial">Ver fonte oficial</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 pb-14 text-center sm:pb-20">
          <h2 className="text-2xl font-bold sm:text-3xl">Conheça o APE no seu ritmo</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Crie seu acesso para salvar conteúdo e progresso ou visite o portal sem entrar em áreas privadas.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <SmartCTA destination="app" placement="section" size="lg" label="Criar acesso" authedLabel="Continuar estudando" />
            <Button asChild size="lg" variant="outline">
              <Link to="/portal">Abrir portal público</Link>
            </Button>
          </div>
        </section>
      </main>

      <PublicFooter />
      <LandingStickyCTA />
    </div>
  );
}
