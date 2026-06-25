import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Coins,
  Compass,
  FlaskConical,
  FolderTree,
  GraduationCap,
  LockKeyhole,
  PackageOpen,
  Presentation,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { cn } from "@/lib/utils";

type HelpPath = "student" | "teacher" | "explore";
type HelpScreen = "choose" | HelpPath;

interface BenefitItem {
  icon: typeof Coins;
  title: string;
  description: string;
}

const LANDING_HELP_STORAGE_KEY = "ape-landing-help-v1-dismissed";

const ACCOUNT_BENEFITS: BenefitItem[] = [
  {
    icon: Coins,
    title: "Pontos e PiteCOIN",
    description: "Ganhe recompensas ao estudar e concluir atividades.",
  },
  {
    icon: PackageOpen,
    title: "Pacotes visuais",
    description: "Acesse a loja e use pacotes compostos por card e avatar.",
  },
  {
    icon: Target,
    title: "Progresso sincronizado",
    description: "Mantenha histórico, metas e evolução ligados à sua conta.",
  },
  {
    icon: Users,
    title: "Turmas e professores",
    description: "Entre em turmas, acompanhe atividades e siga professores.",
  },
];

const TEACHER_BENEFITS: BenefitItem[] = [
  {
    icon: FolderTree,
    title: "Listas e materiais",
    description: "Crie, organize e importe atividades para seus alunos.",
  },
  {
    icon: Users,
    title: "Turmas e alunos",
    description: "Distribua atividades e acompanhe a participação da turma.",
  },
  {
    icon: Presentation,
    title: "Perfil público",
    description: "Compartilhe seus materiais por um perfil próprio.",
  },
  {
    icon: Target,
    title: "Acompanhamento",
    description: "Visualize progresso e desempenho dos alunos vinculados.",
  },
];

const HELP_PATHS = [
  {
    id: "student" as const,
    icon: GraduationCap,
    eyebrow: "Aprender",
    title: "Quero estudar inglês",
    description: "Escolher entre conta gratuita ou acesso sem conta.",
    cardClass: "border-primary/45 bg-card hover:border-primary/75 hover:bg-primary/5",
    iconClass: "border-primary/30 bg-primary text-primary-foreground shadow-sm",
    eyebrowClass: "text-primary",
  },
  {
    id: "teacher" as const,
    icon: Presentation,
    eyebrow: "Ensinar",
    title: "Quero ensinar",
    description: "Criar uma conta de professor para usar os recursos de ensino.",
    cardClass: "border-secondary/45 bg-card hover:border-secondary/75 hover:bg-secondary/5",
    iconClass: "border-secondary/30 bg-secondary text-secondary-foreground shadow-sm",
    eyebrowClass: "text-secondary",
  },
  {
    id: "explore" as const,
    icon: Compass,
    eyebrow: "Explorar",
    title: "Quero apenas explorar",
    description: "Conhecer professores e materiais públicos sem criar conta.",
    cardClass: "border-accent/45 bg-card hover:border-accent/75 hover:bg-accent/5",
    iconClass: "border-accent/30 bg-accent text-accent-foreground shadow-sm",
    eyebrowClass: "text-accent",
  },
];

function BenefitsGrid({ items }: { items: BenefitItem[] }) {
  return (
    <div className="mt-3 grid gap-1.5 sm:mt-4 sm:grid-cols-2 sm:gap-2">
      {items.map(({ icon: Icon, title, description }) => (
        <div
          key={title}
          className="flex gap-2 rounded-xl border border-border/70 bg-muted/30 p-2.5 sm:gap-2.5 sm:p-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-8 sm:w-8">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
          <div>
            <p className="text-[11px] font-extrabold leading-tight text-foreground sm:text-sm">{title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:mt-1 sm:text-xs sm:leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function hasDismissedHelp(): boolean {
  try {
    return window.localStorage.getItem(LANDING_HELP_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberHelpDismissal(): void {
  try {
    window.localStorage.setItem(LANDING_HELP_STORAGE_KEY, "true");
  } catch {
    // The overlay still closes when storage is unavailable.
  }
}

export function LandingHelpOverlay() {
  const [searchParams] = useSearchParams();
  const forcePreview = searchParams.get("help-preview") === "1";
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<HelpScreen>("choose");

  useEffect(() => {
    if (forcePreview || !hasDismissedHelp()) {
      setOpen(true);
    }
  }, [forcePreview]);

  const closeHelp = () => {
    if (!forcePreview) rememberHelpDismissal();
    setOpen(false);
    setScreen("choose");
  };

  return (
    <>
      {forcePreview && !open && (
        <Button
          type="button"
          size="sm"
          className="btn-premium fixed right-3 top-20 z-40 gap-1.5 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Abrir rascunho
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setOpen(true);
          else closeHelp();
        }}
      >
        <DialogContent
          hideClose
          className="bottom-0 left-0 top-auto grid max-h-[84svh] w-full max-w-none grid-rows-[auto_minmax(0,1fr)] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-[1.6rem] border-x-0 border-b-0 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[90vh] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[2rem] sm:border"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent px-4 pb-4 pt-4 text-primary-foreground sm:px-7 sm:pb-7 sm:pt-6">
            <div
              aria-hidden="true"
              className="absolute -right-14 -top-16 h-44 w-44 rounded-full border border-white/15 bg-white/10"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]"
            />

            <DialogClose asChild>
              <button
                type="button"
                aria-label="Fechar ajuda"
                title="Fechar ajuda"
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-black/20 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:right-4 sm:top-4 sm:h-10 sm:w-10"
              >
                <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </button>
            </DialogClose>

            <div className="relative flex items-center gap-3 pr-9 sm:gap-4 sm:pr-10">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border border-white/25 bg-white/15 shadow-xl backdrop-blur-md sm:h-20 sm:w-20 sm:rounded-[1.4rem]">
                <div className="absolute inset-1.5 rounded-xl bg-white/10 sm:inset-2 sm:rounded-2xl" aria-hidden="true" />
                <PitecoLogo className="relative h-12 w-12 sm:h-[4.5rem] sm:w-[4.5rem]" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/90 backdrop-blur sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
                  {forcePreview ? <FlaskConical className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                  {forcePreview ? "Preview de rascunho" : "Guia rápido"}
                </span>
                <p className="mt-1.5 text-base font-extrabold leading-tight sm:mt-2 sm:text-xl">Olá! Eu sou o Piteco.</p>
                <p className="mt-0.5 text-[11px] leading-tight text-white/80 sm:text-sm sm:leading-normal">
                  Vou mostrar só o caminho essencial.
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 overscroll-contain overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-7 sm:pb-7 sm:pt-6">
            <div className="mb-2.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:mb-4 sm:text-[10px] sm:tracking-[0.14em]">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {screen === "choose" ? "1" : "2"}
              </span>
              {screen === "choose" ? "Escolha seu objetivo" : "Escolha seu caminho"}
              <span className="h-px flex-1 bg-border" />
            </div>

            {screen === "choose" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-extrabold leading-tight sm:text-[1.75rem]">
                    Como você quer usar o APE?
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs leading-snug sm:mt-1 sm:text-sm sm:leading-relaxed">
                    Escolha uma opção. A ajuda mostra somente o próximo passo certo para você.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-3 grid gap-2 sm:mt-5 sm:gap-3">
                  {HELP_PATHS.map(({ id, icon: Icon, eyebrow, title, description, cardClass, iconClass, eyebrowClass }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setScreen(id)}
                      className={cn(
                        "group flex min-h-[4.35rem] w-full items-center gap-2.5 rounded-[1.1rem] border p-2.5 text-left text-foreground shadow-sm transition-all duration-200 sm:min-h-[5.35rem] sm:gap-3.5 sm:rounded-[1.35rem] sm:p-3.5",
                        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        cardClass,
                      )}
                    >
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12 sm:rounded-2xl", iconClass)}>
                        <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[9px] font-extrabold uppercase tracking-[0.12em] sm:text-[10px] sm:tracking-[0.14em]", eyebrowClass)}>
                          {eyebrow}
                        </span>
                        <span className="mt-0.5 block text-sm font-extrabold leading-tight text-foreground sm:text-base">{title}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground sm:mt-1 sm:text-[13px] sm:leading-relaxed">
                          {description}
                        </span>
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground sm:h-8 sm:w-8">
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {screen === "student" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-extrabold leading-tight sm:text-[1.75rem]">
                    Você pode estudar com ou sem conta
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs leading-snug sm:mt-1 sm:text-sm sm:leading-relaxed">
                    O conteúdo público continua aberto. A conta gratuita libera o sistema completo de progresso e recompensas.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-3 rounded-[1.2rem] border border-primary/35 bg-card p-3 shadow-sm sm:mt-5 sm:rounded-[1.4rem] sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
                      <Sparkles className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary sm:text-xs sm:tracking-[0.12em]">Conta gratuita</p>
                      <p className="mt-0.5 text-sm font-extrabold text-foreground sm:mt-1 sm:text-base">
                        Estude e desbloqueie todos os benefícios
                      </p>
                    </div>
                  </div>
                  <BenefitsGrid items={ACCOUNT_BENEFITS} />
                </div>

                <div className="mt-2.5 rounded-[1.1rem] border border-border bg-muted/25 p-3 sm:mt-3 sm:rounded-[1.25rem] sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm sm:h-10 sm:w-10">
                      <BookOpenCheck className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-foreground sm:text-base">Estudar sem conta</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:mt-1 sm:text-xs sm:leading-relaxed">
                        Você pode acessar professores, materiais e jogos públicos. Porém, não recebe Pontos ou PiteCOIN, não usa a loja nem os pacotes visuais de card e avatar, e o progresso não fica sincronizado em uma conta.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-2.5">
                  <Button asChild className="btn-premium h-10 gap-1.5 rounded-xl font-bold sm:h-11">
                    <Link to="/auth?mode=signup&role=student" onClick={closeHelp}>
                      Criar conta gratuita <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 gap-1.5 rounded-xl font-bold sm:h-11">
                    <Link to="/portal" onClick={closeHelp}>Continuar sem conta</Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setScreen("choose")} className="h-8 gap-1.5 text-muted-foreground sm:h-9">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
              </>
            )}

            {screen === "teacher" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="flex items-center gap-2 text-xl font-extrabold leading-tight sm:text-[1.75rem]">
                    <LockKeyhole className="h-5 w-5 text-secondary sm:h-6 sm:w-6" /> Conta obrigatória para ensinar
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs leading-snug sm:mt-1 sm:text-sm sm:leading-relaxed">
                    Os recursos de professor precisam de uma conta para proteger materiais, turmas e dados dos alunos.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-3 rounded-[1.2rem] border border-secondary/35 bg-card p-3 shadow-sm sm:mt-5 sm:rounded-[1.4rem] sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
                      <Presentation className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-secondary sm:text-xs sm:tracking-[0.12em]">Conta de professor</p>
                      <p className="mt-0.5 text-sm font-extrabold text-foreground sm:mt-1 sm:text-base">Organize, compartilhe e acompanhe</p>
                    </div>
                  </div>
                  <BenefitsGrid items={TEACHER_BENEFITS} />
                </div>

                <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-2.5">
                  <Button asChild className="btn-premium h-10 gap-1.5 rounded-xl font-bold sm:h-11">
                    <Link to="/auth?mode=signup&role=teacher" onClick={closeHelp}>
                      Criar conta de professor <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl font-bold sm:h-11">
                    <Link to="/auth?role=teacher" onClick={closeHelp}>Já tenho uma conta</Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setScreen("choose")} className="h-8 gap-1.5 text-muted-foreground sm:h-9">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
              </>
            )}

            {screen === "explore" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-extrabold leading-tight sm:text-[1.75rem]">Explore o portal público</DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs leading-snug sm:mt-1 sm:text-sm sm:leading-relaxed">
                    Você será levado à lista de professores públicos. Por enquanto, o Professor Pedro é o perfil principal disponível.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-3 rounded-[1.2rem] border border-accent/35 bg-card p-3 shadow-sm sm:mt-5 sm:rounded-[1.4rem] sm:p-4">
                  <div className="flex gap-2.5 sm:gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
                      <Compass className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-foreground sm:text-base">O que você encontra</p>
                      <div className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground sm:mt-2 sm:space-y-1.5 sm:text-xs sm:leading-relaxed">
                        <p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> Perfis de professores e seus materiais públicos.</p>
                        <p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> Atividades, listas e jogos que podem ser abertos sem conta.</p>
                        <p className="flex gap-2"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> Pontuação, PiteCOIN, loja e pacotes visuais exigem conta.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-2.5">
                  <Button asChild className="btn-premium h-10 gap-1.5 rounded-xl font-bold sm:h-11">
                    <Link to="/portal" onClick={closeHelp}>
                      Abrir portal público <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl font-bold sm:h-11">
                    <Link to="/auth?mode=signup&role=student" onClick={closeHelp}>Criar conta gratuita</Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setScreen("choose")} className="h-8 gap-1.5 text-muted-foreground sm:h-9">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
              </>
            )}

            <div className="mt-4 hidden items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground sm:flex">
              {forcePreview ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-primary" /> : <X className="h-3.5 w-3.5 shrink-0" />}
              {forcePreview
                ? "Fluxo modular de rascunho. Nenhuma escolha será salva."
                : "Você pode fechar este guia e continuar explorando a landing normalmente."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const LandingHelpPreview = LandingHelpOverlay;
