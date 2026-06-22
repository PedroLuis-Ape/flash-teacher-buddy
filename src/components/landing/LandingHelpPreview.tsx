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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
    cardClass: "border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-card hover:border-primary/55",
    iconClass: "border-primary/25 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary))]",
    eyebrowClass: "text-primary",
  },
  {
    id: "teacher" as const,
    icon: Presentation,
    eyebrow: "Ensinar",
    title: "Quero ensinar",
    description: "Criar uma conta de professor para usar os recursos de ensino.",
    cardClass: "border-secondary/25 bg-gradient-to-br from-secondary/15 via-secondary/5 to-card hover:border-secondary/55",
    iconClass: "border-secondary/25 bg-gradient-to-br from-secondary to-primary text-secondary-foreground shadow-[0_10px_24px_-12px_hsl(var(--secondary))]",
    eyebrowClass: "text-secondary",
  },
  {
    id: "explore" as const,
    icon: Compass,
    eyebrow: "Explorar",
    title: "Quero apenas explorar",
    description: "Conhecer professores e materiais públicos sem criar conta.",
    cardClass: "border-accent/25 bg-gradient-to-br from-accent/15 via-accent/5 to-card hover:border-accent/55",
    iconClass: "border-accent/25 bg-gradient-to-br from-accent to-primary-glow text-accent-foreground shadow-[0_10px_24px_-12px_hsl(var(--accent))]",
    eyebrowClass: "text-accent",
  },
];

function BenefitsGrid({ items }: { items: BenefitItem[] }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, description }) => (
        <div key={title} className="flex gap-2.5 rounded-xl border border-border/70 bg-background/60 p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-extrabold leading-tight sm:text-sm">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LandingHelpPreview() {
  const [searchParams] = useSearchParams();
  const enabled = searchParams.get("help-preview") === "1";
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<HelpScreen>("choose");

  useEffect(() => {
    if (enabled) setOpen(true);
  }, [enabled]);

  if (!enabled) return null;

  const resetAndClose = () => {
    setOpen(false);
    setScreen("choose");
  };

  return (
    <>
      {!open && (
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
          setOpen(nextOpen);
          if (!nextOpen) setScreen("choose");
        }}
      >
        <DialogContent className="bottom-0 left-0 top-auto max-h-[94svh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-[2rem] border-x-0 border-b-0 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[2rem] sm:border">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent px-5 pb-6 pt-5 text-primary-foreground sm:px-7 sm:pb-7 sm:pt-6">
            <div aria-hidden="true" className="absolute -right-14 -top-16 h-44 w-44 rounded-full border border-white/15 bg-white/10" />
            <div aria-hidden="true" className="absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
            <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />

            <div className="relative flex items-center gap-4 pr-8">
              <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1.4rem] border border-white/25 bg-white/15 shadow-xl backdrop-blur-md sm:h-20 sm:w-20">
                <div className="absolute inset-2 rounded-2xl bg-white/10" aria-hidden="true" />
                <PitecoLogo className="relative h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/90 backdrop-blur">
                  <FlaskConical className="h-3 w-3" /> Preview de rascunho
                </span>
                <p className="mt-2 text-lg font-extrabold leading-tight sm:text-xl">Olá! Eu sou o Piteco.</p>
                <p className="mt-0.5 text-xs text-white/75 sm:text-sm">Vou mostrar só o caminho essencial.</p>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto px-4 pb-4 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {screen === "choose" ? "1" : "2"}
              </span>
              {screen === "choose" ? "Escolha seu objetivo" : "Escolha seu caminho"}
              <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>

            {screen === "choose" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">Como você quer usar o APE?</DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    Escolha uma opção. A ajuda mostra somente o próximo passo certo para você.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 grid gap-3">
                  {HELP_PATHS.map(({ id, icon: Icon, eyebrow, title, description, cardClass, iconClass, eyebrowClass }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setScreen(id)}
                      className={cn(
                        "group relative flex min-h-[5.35rem] w-full items-center gap-3.5 overflow-hidden rounded-[1.35rem] border p-3.5 text-left shadow-sm transition-all duration-200",
                        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        cardClass,
                      )}
                    >
                      <span aria-hidden="true" className="absolute -right-7 -top-8 h-24 w-24 rounded-full border border-white/20 bg-white/10" />
                      <span className={cn("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", iconClass)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="relative min-w-0 flex-1">
                        <span className={cn("block text-[10px] font-extrabold uppercase tracking-[0.14em]", eyebrowClass)}>{eyebrow}</span>
                        <span className="mt-0.5 block text-[15px] font-extrabold leading-tight sm:text-base">{title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{description}</span>
                      </span>
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/70 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {screen === "student" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">Você pode estudar com ou sem conta</DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    O conteúdo público continua aberto. A conta gratuita libera o sistema completo de progresso e recompensas.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 rounded-[1.4rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Conta gratuita</p>
                      <p className="mt-1 font-extrabold">Estude e desbloqueie todos os benefícios</p>
                    </div>
                  </div>
                  <BenefitsGrid items={ACCOUNT_BENEFITS} />
                </div>

                <div className="mt-3 rounded-[1.25rem] border border-border bg-muted/25 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
                      <BookOpenCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-extrabold">Estudar sem conta</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Você pode acessar professores, materiais e jogos públicos. Porém, não recebe Pontos ou PiteCOIN, não usa a loja nem os pacotes visuais de card e avatar, e o progresso não fica sincronizado em uma conta.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2.5">
                  <Button asChild className="btn-premium h-11 gap-1.5 rounded-xl font-bold">
                    <Link to="/auth?mode=signup&role=student" onClick={resetAndClose}>
                      Criar conta gratuita <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 gap-1.5 rounded-xl font-bold">
                    <Link to="/portal" onClick={resetAndClose}>
                      Continuar sem conta
                    </Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setScreen("choose")} className="h-9 gap-1.5 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
              </>
            )}

            {screen === "teacher" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold leading-tight sm:text-[1.75rem]">
                    <LockKeyhole className="h-6 w-6 text-secondary" /> Conta obrigatória para ensinar
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    Os recursos de professor precisam de uma conta para proteger materiais, turmas e dados dos alunos.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 rounded-[1.4rem] border border-secondary/25 bg-gradient-to-br from-secondary/15 via-secondary/5 to-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-primary text-secondary-foreground shadow-lg">
                      <Presentation className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-secondary">Conta de professor</p>
                      <p className="mt-1 font-extrabold">Organize, compartilhe e acompanhe</p>
                    </div>
                  </div>
                  <BenefitsGrid items={TEACHER_BENEFITS} />
                </div>

                <div className="mt-5 grid gap-2.5">
                  <Button asChild className="btn-premium h-11 gap-1.5 rounded-xl font-bold">
                    <Link to="/auth?mode=signup&role=teacher" onClick={resetAndClose}>
                      Criar conta de professor <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl font-bold">
                    <Link to="/auth?role=teacher" onClick={resetAndClose}>Já tenho uma conta</Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setScreen("choose")} className="h-9 gap-1.5 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
              </>
            )}

            {screen === "explore" && (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">Explore o portal público</DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    Você será levado à lista de professores públicos. Por enquanto, o Professor Pedro é o perfil principal disponível.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 rounded-[1.4rem] border border-accent/25 bg-gradient-to-br from-accent/15 via-accent/5 to-card p-4 shadow-sm">
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary-glow text-accent-foreground shadow-lg">
                      <Compass className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-extrabold">O que você encontra</p>
                      <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                        <p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> Perfis de professores e seus materiais públicos.</p>
                        <p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> Atividades, listas e jogos que podem ser abertos sem conta.</p>
                        <p className="flex gap-2"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> Pontuação, PiteCOIN, loja e pacotes visuais exigem conta.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2.5">
                  <Button asChild className="btn-premium h-11 gap-1.5 rounded-xl font-bold">
                    <Link to="/portal" onClick={resetAndClose}>
                      Abrir portal público <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl font-bold">
                    <Link to="/auth?mode=signup&role=student" onClick={resetAndClose}>Criar conta gratuita</Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setScreen("choose")} className="h-9 gap-1.5 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
              </>
            )}

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5 text-primary" />
              Fluxo modular de rascunho. Nenhuma escolha será salva.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
