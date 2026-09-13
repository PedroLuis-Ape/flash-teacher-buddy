/**
 * Convite discreto para instalar a extensão "Salvar nas Notas".
 *
 * Regra de ouro (UX): o app NÃO instala nada. O CTA abre a Chrome Web Store em
 * nova aba e o usuário confirma a instalação no navegador.
 *
 * Renderiza somente quando: usuário autenticado + navegador compatível +
 * extensão não detectada + snooze vencido + convite não visto nesta sessão.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, MousePointer2, Puzzle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AUTO_DISMISS_MS,
  EXIT_ANIMATION_MS,
  INSTALL_GUIDE_URL,
  SHOW_DELAY_MS,
  WEB_STORE_URL,
} from "./extensionConfig";
import {
  isPromptSnoozed,
  rememberPromptSeenThisSession,
  snoozeExtensionPrompt,
  wasPromptSeenThisSession,
} from "./extensionPromptStorage";
import { useBrowserExtensionStatus } from "./useBrowserExtensionStatus";

type PromptPhase = "idle" | "waiting" | "entering" | "visible" | "closing";

interface ExtensionInstallPromptProps {
  /** O convite só existe para usuário autenticado (default: false). */
  authenticated?: boolean;
}

export function ExtensionInstallPrompt({ authenticated = false }: ExtensionInstallPromptProps) {
  const { status } = useBrowserExtensionStatus({ enabled: authenticated });
  const [phase, setPhase] = useState<PromptPhase>("idle");
  const [dismissed, setDismissed] = useState(false);
  const [snoozed] = useState(() => isPromptSnoozed());
  const seenThisSessionRef = useRef<boolean | null>(null);

  if (seenThisSessionRef.current === null) {
    seenThisSessionRef.current = wasPromptSeenThisSession();
  }

  const eligible =
    authenticated &&
    status === "missing" &&
    !snoozed &&
    !dismissed &&
    !seenThisSessionRef.current;

  const dismiss = useCallback((reason: "auto" | "explicit") => {
    rememberPromptSeenThisSession();
    seenThisSessionRef.current = true;
    if (reason === "explicit") {
      // Só o fechamento explícito gera snooze de 7 dias.
      snoozeExtensionPrompt();
    }
    setDismissed(true);
    setPhase("closing");
  }, []);

  useEffect(() => {
    if (!eligible) {
      // Aguardando → nada foi renderizado. Visível → esconde (ex.: extensão
      // detectada ao voltar o foco para a janela).
      setPhase((current) => {
        if (current === "waiting") return "idle";
        if (current === "entering" || current === "visible") return "closing";
        return current;
      });
      return;
    }

    setPhase("waiting");
    const showTimer = window.setTimeout(() => {
      // Revalida o snooze no momento de aparecer (ex.: fechado em outra aba).
      if (isPromptSnoozed()) {
        setPhase("idle");
        return;
      }
      setPhase("entering");
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(showTimer);
  }, [eligible]);

  useEffect(() => {
    // Monta invisível e só então anima a entrada: nada de elemento invisível
    // (e ainda focável) ocupando a tela durante a espera.
    if (phase !== "entering") return;
    const supportsFrame = typeof window.requestAnimationFrame === "function";
    const handle = supportsFrame
      ? window.requestAnimationFrame(() => setPhase("visible"))
      : window.setTimeout(() => setPhase("visible"), 0);
    return () => {
      if (supportsFrame && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "entering" && phase !== "visible") return;
    const autoDismissTimer = window.setTimeout(() => dismiss("auto"), AUTO_DISMISS_MS);
    return () => window.clearTimeout(autoDismissTimer);
  }, [dismiss, phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const exitTimer = window.setTimeout(() => setPhase("idle"), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(exitTimer);
  }, [phase]);

  if (phase === "idle" || phase === "waiting") return null;

  const isVisible = phase === "visible";

  return (
    <aside
      aria-label="Convite para instalar a extensão Salvar nas Notas"
      aria-live="polite"
      className={`fixed bottom-20 right-4 z-40 hidden w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur transition-all duration-300 ease-out motion-reduce:transition-none md:block ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={() => dismiss("explicit")}
        aria-label="Fechar convite da extensão"
        className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Puzzle className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Ferramenta para navegador
          </p>
          <h2 className="mt-1 text-lg font-bold">Salvar nas Notas</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Selecione palavras em qualquer site, ouça em inglês americano e salve trechos para
            revisar no APE.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <MousePointer2 className="h-3.5 w-3.5 text-primary" /> Selecionar
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <Headphones className="h-3.5 w-3.5 text-primary" /> Ouvir en-US
        </span>
      </div>

      <Button asChild size="lg" className="mt-3 w-full text-base font-bold">
        <a href={WEB_STORE_URL} target="_blank" rel="noopener noreferrer">
          Instalar extensão
        </a>
      </Button>

      <a
        href={INSTALL_GUIDE_URL}
        className="mt-2 block text-center text-[11px] font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
      >
        Como funciona a extensão
      </a>
      <p className="mt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Chrome e Edge no computador. O navegador sempre pede uma confirmação final.
      </p>
    </aside>
  );
}

export default ExtensionInstallPrompt;
