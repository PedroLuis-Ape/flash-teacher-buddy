import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Coins,
  Compass,
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
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { cn } from "@/lib/utils";
import { LandingHelpOverlay as DesktopLandingHelpOverlay } from "./LandingHelpPreview.tsx";

type MobileHelpScreen = "choose" | "student" | "teacher" | "explore";

const STORAGE_KEY = "ape-landing-help-v1-dismissed";

const PATHS = [
  {
    id: "student" as const,
    icon: GraduationCap,
    label: "Aprender",
    title: "Quero estudar inglês",
    accent: "text-primary",
    iconClass: "bg-primary text-primary-foreground",
    borderClass: "border-primary/35",
  },
  {
    id: "teacher" as const,
    icon: Presentation,
    label: "Ensinar",
    title: "Quero ensinar",
    accent: "text-secondary",
    iconClass: "bg-secondary text-secondary-foreground",
    borderClass: "border-secondary/35",
  },
  {
    id: "explore" as const,
    icon: Compass,
    label: "Explorar",
    title: "Quero apenas explorar",
    accent: "text-accent",
    iconClass: "bg-accent text-accent-foreground",
    borderClass: "border-accent/35",
  },
];

function hasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Closing still works when storage is unavailable.
  }
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 639px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function CompactBenefit({ icon: Icon, title }: { icon: typeof Coins; title: string }) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[11px] font-bold leading-tight text-foreground">{title}</span>
    </div>
  );
}

function MobileLandingHelpOverlay() {
  const [searchParams] = useSearchParams();
  const forcePreview = searchParams.get("help-preview") === "1";
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<MobileHelpScreen>("choose");

  useEffect(() => {
    if (forcePreview || !hasDismissed()) setOpen(true);
  }, [forcePreview]);

  const close = () => {
    if (!forcePreview) rememberDismissal();
    setOpen(false);
    setScreen("choose");
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
        else close();
      }}
    >
      {forcePreview && !open && (
        <Button
          type="button"
          size="sm"
          className="btn-premium fixed right-3 top-20 z-40 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          Abrir guia
        </Button>
      )}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          aria-describedby="mobile-landing-help-description"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[68svh] flex-col overflow-hidden rounded-t-[1.65rem] border border-b-0 border-border/70 bg-card/98 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        >
          <div className="shrink-0 bg-gradient-to-br from-primary via-primary to-accent px-4 pb-3 pt-2.5 text-primary-foreground">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/35" aria-hidden="true" />

            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Fechar guia"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/15 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>

            <div className="flex items-center gap-2.5 pr-9">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15">
                <PitecoLogo className="h-10 w-10" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/80">
                  <Sparkles className="h-3 w-3" /> Guia rápido
                </div>
                <DialogPrimitive.Title className="mt-0.5 truncate text-base font-extrabold leading-tight">
                  Olá! Eu sou o Piteco.
                </DialogPrimitive.Title>
                <DialogPrimitive.Description
                  id="mobile-landing-help-description"
                  className="mt-0.5 text-[10px] leading-tight text-white/75"
                >
                  Escolha um caminho para continuar.
                </DialogPrimitive.Description>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
            {screen === "choose" && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                  Como você quer usar o APE?
                </p>

                <div className="mt-2 grid gap-2">
                  {PATHS.map(({ id, icon: Icon, label, title, accent, iconClass, borderClass }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setScreen(id)}
                      className={cn(
                        "flex min-h-[3.7rem] w-full items-center gap-2.5 rounded-2xl border bg-card px-2.5 py-2 text-left shadow-sm active:scale-[0.99]",
                        borderClass,
                      )}
                    >
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClass)}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[9px] font-extrabold uppercase tracking-[0.12em]", accent)}>
                          {label}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-extrabold leading-tight text-foreground">
                          {title}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="mx-auto mt-3 block text-[11px] font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  Continuar vendo a landing
                </button>
              </div>
            )}

            {screen === "student" && (
              <div>
                <button type="button" onClick={() => setScreen("choose")} className="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <h2 className="text-lg font-extrabold leading-tight text-foreground">Estude com ou sem conta</h2>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  A conta gratuita salva seu progresso e libera recompensas.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <CompactBenefit icon={Coins} title="Pontos e PiteCOIN" />
                  <CompactBenefit icon={PackageOpen} title="Pacotes visuais" />
                  <CompactBenefit icon={Target} title="Progresso salvo" />
                  <CompactBenefit icon={Users} title="Turmas e professores" />
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/25 p-2.5">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Sem conta, materiais públicos continuam disponíveis, mas sem sincronização ou recompensas.
                  </p>
                </div>

                <div className="mt-3 grid gap-2">
                  <Button asChild className="btn-premium h-10 rounded-xl font-bold">
                    <Link to="/auth?mode=signup&role=student" onClick={close}>
                      Criar conta gratuita <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl font-bold">
                    <Link to="/portal" onClick={close}>Continuar sem conta</Link>
                  </Button>
                </div>
              </div>
            )}

            {screen === "teacher" && (
              <div>
                <button type="button" onClick={() => setScreen("choose")} className="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <h2 className="flex items-center gap-2 text-lg font-extrabold leading-tight text-foreground">
                  <LockKeyhole className="h-5 w-5 text-secondary" /> Conta para ensinar
                </h2>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Proteja materiais, turmas e dados dos alunos em uma conta de professor.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <CompactBenefit icon={Presentation} title="Perfil público" />
                  <CompactBenefit icon={Users} title="Turmas e alunos" />
                  <CompactBenefit icon={Target} title="Acompanhamento" />
                  <CompactBenefit icon={PackageOpen} title="Materiais organizados" />
                </div>

                <div className="mt-3 grid gap-2">
                  <Button asChild className="btn-premium h-10 rounded-xl font-bold">
                    <Link to="/auth?mode=signup&role=teacher" onClick={close}>
                      Criar conta de professor <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl font-bold">
                    <Link to="/auth?role=teacher" onClick={close}>Já tenho uma conta</Link>
                  </Button>
                </div>
              </div>
            )}

            {screen === "explore" && (
              <div>
                <button type="button" onClick={() => setScreen("choose")} className="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <h2 className="text-lg font-extrabold leading-tight text-foreground">Explore o portal público</h2>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Veja professores, materiais e jogos sem criar conta.
                </p>

                <div className="mt-3 space-y-2 rounded-2xl border border-accent/35 bg-card p-3 text-[11px] text-muted-foreground">
                  <p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> Perfis públicos de professores.</p>
                  <p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> Atividades, listas e jogos públicos.</p>
                  <p className="flex gap-2"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Pontos e progresso exigem conta.</p>
                </div>

                <div className="mt-3 grid gap-2">
                  <Button asChild className="btn-premium h-10 rounded-xl font-bold">
                    <Link to="/portal" onClick={close}>
                      Abrir portal público <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl font-bold">
                    <Link to="/auth?mode=signup&role=student" onClick={close}>Criar conta gratuita</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ResponsiveLandingHelpOverlay() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLandingHelpOverlay /> : <DesktopLandingHelpOverlay />;
}
