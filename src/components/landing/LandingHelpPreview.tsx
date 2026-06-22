import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Compass,
  FlaskConical,
  GraduationCap,
  Presentation,
  Sparkles,
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

const HELP_PATHS = [
  {
    id: "student" as const,
    icon: GraduationCap,
    eyebrow: "Aprender",
    title: "Quero estudar inglês",
    description: "Abrir atividades e começar a praticar.",
    destination: "/atividades-de-ingles",
    action: "Ver atividades",
    cardClass: "border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-card hover:border-primary/55",
    iconClass: "border-primary/25 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary))]",
    eyebrowClass: "text-primary",
  },
  {
    id: "teacher" as const,
    icon: Presentation,
    eyebrow: "Ensinar",
    title: "Quero ensinar",
    description: "Conhecer listas, materiais e turmas.",
    destination: "/para-professores",
    action: "Ver recursos para professores",
    cardClass: "border-secondary/25 bg-gradient-to-br from-secondary/15 via-secondary/5 to-card hover:border-secondary/55",
    iconClass: "border-secondary/25 bg-gradient-to-br from-secondary to-primary text-secondary-foreground shadow-[0_10px_24px_-12px_hsl(var(--secondary))]",
    eyebrowClass: "text-secondary",
  },
  {
    id: "explore" as const,
    icon: Compass,
    eyebrow: "Explorar",
    title: "Quero apenas explorar",
    description: "Testar materiais públicos sem compromisso.",
    destination: "/portal",
    action: "Abrir portal público",
    cardClass: "border-accent/25 bg-gradient-to-br from-accent/15 via-accent/5 to-card hover:border-accent/55",
    iconClass: "border-accent/25 bg-gradient-to-br from-accent to-primary-glow text-accent-foreground shadow-[0_10px_24px_-12px_hsl(var(--accent))]",
    eyebrowClass: "text-accent",
  },
];

export function LandingHelpPreview() {
  const [searchParams] = useSearchParams();
  const enabled = searchParams.get("help-preview") === "1";
  const [open, setOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<HelpPath | null>(null);

  useEffect(() => {
    if (enabled) setOpen(true);
  }, [enabled]);

  if (!enabled) return null;

  const selected = HELP_PATHS.find((path) => path.id === selectedPath) ?? null;
  const SelectedIcon = selected?.icon ?? BookOpenCheck;

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
          if (!nextOpen) setSelectedPath(null);
        }}
      >
        <DialogContent className="bottom-0 left-0 top-auto w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-[2rem] border-x-0 border-b-0 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[2rem] sm:border">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent px-5 pb-6 pt-5 text-primary-foreground sm:px-7 sm:pb-7 sm:pt-6">
            <div
              aria-hidden="true"
              className="absolute -right-14 -top-16 h-44 w-44 rounded-full border border-white/15 bg-white/10 blur-[1px]"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]"
            />

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

          <div className="relative px-4 pb-4 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
              Escolha seu objetivo
              <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>

            {!selected ? (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">
                    Como você quer usar o APE?
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    Escolha uma opção. A ajuda mostra somente o próximo passo certo para você.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 grid gap-3">
                  {HELP_PATHS.map(({ id, icon: Icon, eyebrow, title, description, cardClass, iconClass, eyebrowClass }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedPath(id)}
                      className={cn(
                        "group relative flex min-h-[5.35rem] w-full items-center gap-3.5 overflow-hidden rounded-[1.35rem] border p-3.5 text-left shadow-sm transition-all duration-200",
                        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        cardClass,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute -right-7 -top-8 h-24 w-24 rounded-full border border-white/20 bg-white/10"
                      />
                      <span className={cn("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", iconClass)}>
                        <Icon className="h-5.5 w-5.5" />
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

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Nada será salvo nesta versão de rascunho.
                </div>
              </>
            ) : (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">Comece por aqui</DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    Sem passeio pela página inteira. Este é o caminho mais direto para o seu objetivo.
                  </DialogDescription>
                </DialogHeader>

                <div className={cn("relative mt-5 overflow-hidden rounded-[1.5rem] border p-5 shadow-md", selected.cardClass)}>
                  <div aria-hidden="true" className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-white/20 bg-white/10" />
                  <div className="relative flex items-center gap-4">
                    <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border", selected.iconClass)}>
                      <SelectedIcon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("text-[10px] font-extrabold uppercase tracking-[0.14em]", selected.eyebrowClass)}>{selected.eyebrow}</p>
                      <p className="mt-1 text-lg font-extrabold leading-tight">{selected.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2.5 sm:grid-cols-[auto_1fr]">
                  <Button type="button" variant="outline" onClick={() => setSelectedPath(null)} className="h-11 gap-1.5 rounded-xl">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                  <Button asChild className="btn-premium h-11 gap-1.5 rounded-xl font-bold">
                    <Link to={selected.destination} onClick={() => setOpen(false)}>
                      {selected.action} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
