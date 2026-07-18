import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Smartphone } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { requestPortraitOrientationLock } from "@/lib/portraitOrientationLock";

const LANDSCAPE_QUERY = "(orientation: landscape)";
const HANDHELD_QUERY = "(pointer: coarse)";
const MAX_PHONE_SHORT_SIDE = 900;

function isPortraitOnlyRoute(pathname: string): boolean {
  return (
    pathname.endsWith("/games") ||
    pathname.endsWith("/study") ||
    pathname.endsWith("/mixed-study")
  );
}

function isHandheldLandscape(): boolean {
  if (typeof window === "undefined") return false;

  const landscape =
    window.matchMedia?.(LANDSCAPE_QUERY).matches ??
    window.innerWidth > window.innerHeight;
  const handheld =
    (window.matchMedia?.(HANDHELD_QUERY).matches ?? false) ||
    window.navigator.maxTouchPoints > 0;
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  const phoneSized = Math.min(screenWidth, screenHeight) <= MAX_PHONE_SHORT_SIDE;

  return landscape && handheld && phoneSized;
}

export function PortraitOnlyGameGuard() {
  const location = useLocation();
  const activeRoute = isPortraitOnlyRoute(location.pathname);
  const [blocked, setBlocked] = useState(false);

  const refresh = useCallback(() => {
    setBlocked(activeRoute && isHandheldLandscape());
  }, [activeRoute]);

  useEffect(() => {
    refresh();
    if (!activeRoute || typeof window === "undefined") return undefined;

    const landscapeQuery = window.matchMedia(LANDSCAPE_QUERY);
    const handheldQuery = window.matchMedia(HANDHELD_QUERY);

    landscapeQuery.addEventListener("change", refresh);
    handheldQuery.addEventListener("change", refresh);
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);

    return () => {
      landscapeQuery.removeEventListener("change", refresh);
      handheldQuery.removeEventListener("change", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, [activeRoute, refresh]);

  useEffect(() => {
    if (!blocked || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [blocked]);

  const handleRetry = async () => {
    let locked = await requestPortraitOrientationLock();

    if (
      !locked &&
      document.fullscreenEnabled &&
      !document.fullscreenElement
    ) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        locked = await requestPortraitOrientationLock();
      } catch {
        // The overlay remains visible until the device returns to portrait.
      }
    }

    window.setTimeout(refresh, locked ? 120 : 250);
  };

  if (!blocked) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-background px-6 py-8 text-foreground"
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label="Modo vertical obrigatório"
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border bg-card">
          <Smartphone className="h-12 w-12" aria-hidden="true" />
          <RotateCcw
            className="absolute -right-2 -top-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Use o celular na vertical</h1>
          <p className="text-muted-foreground">
            O navegador ignorou a trava de orientação. O jogo foi pausado para
            não quebrar a tela. Gire o aparelho para continuar.
          </p>
        </div>

        <Button type="button" size="lg" className="w-full" onClick={handleRetry}>
          <RotateCcw className="mr-2 h-5 w-5" />
          Tentar voltar ao modo vertical
        </Button>
      </div>
    </div>
  );
}
