import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISPLAY_DURATION_MS = 10_000;

function buildMixedTarget(pathname: string, search: string): string {
  if (pathname === "/" || pathname === "/landing") return "/portal";

  const params = new URLSearchParams(search);
  params.delete("mode");
  params.delete("order");
  const query = params.toString();

  if (pathname.endsWith("/games")) {
    return `${pathname.replace(/\/games$/, "/mixed-study")}${query ? `?${query}` : ""}`;
  }

  if (pathname.endsWith("/study")) {
    return `${pathname.replace(/\/study$/, "/mixed-study")}${query ? `?${query}` : ""}`;
  }

  return "/portal";
}

function shouldShow(pathname: string): boolean {
  if (pathname.includes("/mixed-study")) return false;
  if (pathname === "/" || pathname === "/landing") return true;
  if (pathname.endsWith("/games") || pathname.endsWith("/study")) return true;
  return false;
}

export function MixedModeRecommendationBubble() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const eligible = shouldShow(location.pathname);
  const target = useMemo(
    () => buildMixedTarget(location.pathname, location.search),
    [location.pathname, location.search],
  );

  useEffect(() => {
    setDismissed(false);

    if (!eligible) return undefined;

    const timer = window.setTimeout(() => {
      setDismissed(true);
    }, DISPLAY_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [eligible, location.pathname, location.search]);

  if (!eligible || dismissed) return null;

  const isLanding = location.pathname === "/" || location.pathname === "/landing";

  const handleAction = () => {
    setDismissed(true);
    navigate(target);
  };

  return (
    <aside
      className={cn(
        "fixed right-2 z-40 w-[min(15.5rem,calc(100vw-1rem))] rounded-xl border border-primary/25",
        "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] bg-background/96 p-2.5 shadow-lg backdrop-blur-md",
        "animate-in slide-in-from-bottom-2 fade-in duration-200",
        "sm:bottom-6 sm:right-6 sm:w-[320px] sm:rounded-2xl sm:p-4 sm:shadow-xl",
      )}
      aria-label="Recomendação de modo de estudo"
      role="status"
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9 sm:rounded-xl">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold sm:text-sm">Prática Mista recomendada</p>
              <p className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">
                Rodadas curtas, exercícios variados e revisão automática dos cards errados.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar recomendação"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>

          <Button
            size="sm"
            className="mt-2 h-8 w-full rounded-lg px-3 text-xs sm:mt-3 sm:h-9"
            onClick={handleAction}
          >
            {isLanding ? "Experimentar" : "Começar Prática Mista"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
