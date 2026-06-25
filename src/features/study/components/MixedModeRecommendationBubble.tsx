import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [expanded, setExpanded] = useState(true);
  const visible = shouldShow(location.pathname);
  const target = useMemo(
    () => buildMixedTarget(location.pathname, location.search),
    [location.pathname, location.search],
  );

  useEffect(() => {
    setExpanded(true);
  }, [location.pathname]);

  if (!visible) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          "fixed bottom-20 right-3 z-40 inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-primary/30",
          "bg-background/95 px-3 py-2 text-xs font-semibold text-primary shadow-lg backdrop-blur sm:bottom-6 sm:right-6",
        )}
        aria-label="Abrir recomendação da Prática Mista"
      >
        <Sparkles className="h-4 w-4" />
        Recomendado: Prática Mista
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "fixed bottom-20 left-3 right-3 z-40 rounded-2xl border border-primary/25 bg-background/95 p-3 shadow-xl backdrop-blur",
        "sm:bottom-6 sm:left-auto sm:right-6 sm:w-[340px] sm:p-4",
      )}
      aria-label="Recomendação de modo de estudo"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Prática Mista — modo recomendado</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                Rodadas curtas, exercícios variados e revisão automática dos cards errados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Minimizar recomendação"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={() => navigate(target)}
          >
            {location.pathname === "/" || location.pathname === "/landing"
              ? "Explorar e experimentar"
              : "Começar Prática Mista"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
