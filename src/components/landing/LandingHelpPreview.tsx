import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Compass, FlaskConical, GraduationCap, Users } from "lucide-react";
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
    title: "Quero estudar inglês",
    description: "Abrir atividades e começar a praticar.",
    destination: "/atividades-de-ingles",
    action: "Ver atividades",
  },
  {
    id: "teacher" as const,
    icon: Users,
    title: "Quero ensinar",
    description: "Conhecer listas, materiais e turmas.",
    destination: "/para-professores",
    action: "Ver recursos para professores",
  },
  {
    id: "explore" as const,
    icon: Compass,
    title: "Quero apenas explorar",
    description: "Testar materiais públicos sem compromisso.",
    destination: "/portal",
    action: "Abrir portal público",
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

  return (
    <>
      {!open && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="fixed right-3 top-20 z-40 gap-1.5 rounded-full border shadow-lg"
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
        <DialogContent className="bottom-0 left-0 top-auto w-full max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-3xl border-x-0 border-b-0 p-4 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:gap-4 sm:rounded-2xl sm:border sm:p-6">
          <div className="flex items-center gap-3 pr-8">
            <PitecoLogo className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <FlaskConical className="h-3 w-3" /> Preview de rascunho
              </span>
              <p className="mt-1 text-xs text-muted-foreground">Primeiro pedaço · somente a escolha inicial</p>
            </div>
          </div>

          {!selected ? (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="text-xl sm:text-2xl">Como você quer usar o APE?</DialogTitle>
                <DialogDescription>
                  Escolha uma opção e eu mostro apenas o próximo passo essencial.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2.5">
                {HELP_PATHS.map(({ id, icon: Icon, title, description }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedPath(id)}
                    className={cn(
                      "group flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition",
                      "hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold sm:text-base">{title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">{description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                Nada será salvo nesta versão de rascunho.
              </p>
            </>
          ) : (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="text-xl sm:text-2xl">Comece por aqui</DialogTitle>
                <DialogDescription>
                  Sem passeio pela página inteira. Este é o caminho mais direto para o seu objetivo.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <selected.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold">{selected.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <Button type="button" variant="outline" onClick={() => setSelectedPath(null)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button asChild className="gap-1.5">
                  <Link to={selected.destination} onClick={() => setOpen(false)}>
                    {selected.action} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
