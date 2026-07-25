import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, MousePointer2, Puzzle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const INSTALL_GUIDE_URL = "/extensao/index.html";
const AUTO_HIDE_AFTER_MS = 8_000;
const EXIT_ANIMATION_MS = 300;
const SESSION_DISMISS_KEY = "ape:browser-extension-promo-dismissed:v1";

function wasDismissedThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    // The card still auto-hides when storage is unavailable.
  }
}

export function BrowserExtensionQuickInstall() {
  const [shouldRender, setShouldRender] = useState(() => !wasDismissedThisSession());
  const [isVisible, setIsVisible] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    rememberDismissal();

    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
    }

    exitTimerRef.current = window.setTimeout(() => {
      setShouldRender(false);
    }, EXIT_ANIMATION_MS);
  }, []);

  useEffect(() => {
    if (!shouldRender) return;

    const enterFrame = window.requestAnimationFrame(() => setIsVisible(true));
    const autoHideTimer = window.setTimeout(dismiss, AUTO_HIDE_AFTER_MS);

    return () => {
      window.cancelAnimationFrame(enterFrame);
      window.clearTimeout(autoHideTimer);
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, [dismiss, shouldRender]);

  if (!shouldRender) return null;

  return (
    <aside
      aria-label="Extensão APE Pronúncia e Notas"
      aria-live="polite"
      className={`fixed bottom-20 right-4 z-40 hidden w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur transition-all duration-300 ease-out motion-reduce:transition-none md:block ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={dismiss}
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
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Ferramenta para navegador</p>
          <h2 className="mt-1 text-lg font-bold">APE Pronúncia e Notas</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Selecione palavras em qualquer site, ouça em inglês americano e salve trechos para revisar.
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
        <a href={INSTALL_GUIDE_URL}>Instalar a extensão</a>
      </Button>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Chrome e Edge no computador. O navegador sempre pede uma confirmação final.
      </p>
    </aside>
  );
}
