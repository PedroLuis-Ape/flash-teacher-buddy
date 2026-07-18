import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobilePortraitOnlyGateProps {
  active: boolean;
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary") => Promise<void>;
};

const MOBILE_LANDSCAPE_QUERY =
  "(orientation: landscape) and (max-height: 600px) and (pointer: coarse)";

async function tryToRestorePortrait(): Promise<void> {
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Fullscreen is optional; the orientation request may still work without it.
  }

  try {
    const orientation = window.screen?.orientation as
      | LockableScreenOrientation
      | undefined;
    await orientation?.lock?.("portrait-primary");
  } catch {
    // Some mobile browsers deny orientation locking even after a user gesture.
  }
}

/**
 * Reliable fallback for mobile browsers that ignore the PWA manifest and the
 * Screen Orientation API. Instead of letting a study session become unusable
 * in landscape, the game is covered until the device returns to portrait.
 */
export function MobilePortraitOnlyGate({ active }: MobilePortraitOnlyGateProps) {
  const [blocked, setBlocked] = useState(false);

  const refresh = useCallback(() => {
    if (!active || typeof window.matchMedia !== "function") {
      setBlocked(false);
      return;
    }

    setBlocked(window.matchMedia(MOBILE_LANDSCAPE_QUERY).matches);
  }, [active]);

  useEffect(() => {
    refresh();
    if (!active || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(MOBILE_LANDSCAPE_QUERY);
    const handleChange = () => refresh();

    query.addEventListener?.("change", handleChange);
    window.addEventListener("resize", handleChange);
    window.addEventListener("orientationchange", handleChange);

    return () => {
      query.removeEventListener?.("change", handleChange);
      window.removeEventListener("resize", handleChange);
      window.removeEventListener("orientationchange", handleChange);
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!blocked) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [blocked]);

  if (!active || !blocked) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background px-6 py-[calc(1.5rem+env(safe-area-inset-top))] text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-portrait-title"
      aria-describedby="mobile-portrait-description"
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border bg-card">
          <Smartphone className="h-11 w-11" aria-hidden="true" />
          <RotateCcw
            className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-primary p-1.5 text-primary-foreground"
            aria-hidden="true"
          />
        </div>

        <h1 id="mobile-portrait-title" className="text-2xl font-bold">
          Mantenha o celular na vertical
        </h1>
        <p
          id="mobile-portrait-description"
          className="mt-3 max-w-xs text-base text-muted-foreground"
        >
          Esta sessão foi feita para o modo vertical. Gire o celular para
          continuar sem cortar os controles do jogo.
        </p>

        <Button
          type="button"
          size="lg"
          className="mt-6 min-h-12 w-full"
          onClick={() => void tryToRestorePortrait()}
        >
          <RotateCcw className="mr-2 h-5 w-5" aria-hidden="true" />
          Tentar voltar ao modo vertical
        </Button>

        <p className="mt-3 text-sm text-muted-foreground">
          Se o navegador bloquear a rotação automática, basta colocar o aparelho
          de pé.
        </p>
      </div>
    </div>
  );
}
