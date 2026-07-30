import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Languages, Shuffle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";
import {
  DEFAULT_WRITE_ACTIVITY_PREFERENCE,
  WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT,
  readWriteActivityPreference,
  writeWriteActivityPreference,
  type WriteActivityMode,
  type WriteActivityPreference,
  type WriteActivityPreferenceChangedDetail,
  type WriteRewriteSide,
} from "@/features/study/lib/writeActivityMode";

export function WriteActivitySettings() {
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get("mode");
  const playRuntime = usePlayPresetRuntime();
  const [expanded, setExpanded] = useState(false);
  const [preference, setPreference] = useState<WriteActivityPreference>(() =>
    typeof window === "undefined"
      ? { ...DEFAULT_WRITE_ACTIVITY_PREFERENCE }
      : readWriteActivityPreference("write"),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WriteActivityPreferenceChangedDetail>).detail;
      if (detail?.gameMode === "write") setPreference(detail.preference);
    };
    window.addEventListener(WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT, handler as EventListener);
  }, []);

  if (mode !== "write") return null;

  const updateMode = (nextMode: WriteActivityMode) => {
    const next = { ...preference, mode: nextMode };
    setPreference(next);
    writeWriteActivityPreference(next, "write");
  };

  const updateSide = (rewriteSide: WriteRewriteSide) => {
    const next = { ...preference, rewriteSide };
    setPreference(next);
    writeWriteActivityPreference(next, "write");
  };

  const sideSummary = preference.rewriteSide === "a"
    ? playRuntime.labelA
    : preference.rewriteSide === "b"
      ? playRuntime.labelB
      : "alternando os lados";
  const summary = preference.mode === "translate"
    ? "Traduzir de um lado para o outro"
    : `Reescrever · ${sideSummary}`;

  return (
    <div className="rounded-xl border bg-background/40">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className={cn(
          "flex min-h-[56px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
          "hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/60",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Copy className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">Atividade de escrita</span>
          <span className="block truncate text-sm text-muted-foreground">{summary}</span>
        </span>
        {expanded
          ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t px-4 py-4">
          <div>
            <p className="font-medium">Como você quer praticar?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Traduza o card ou reescreva o texto que está vendo no mesmo idioma.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => updateMode("translate")}
              aria-pressed={preference.mode === "translate"}
              className={cn(
                "flex min-h-[96px] flex-col items-start gap-1 rounded-xl border p-4 text-left",
                preference.mode === "translate"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-accent/40",
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Languages className="h-4 w-4" /> Traduzir
              </span>
              <span className="text-sm text-muted-foreground">
                Veja um lado do card e escreva o conteúdo do outro lado.
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateMode("rewrite")}
              aria-pressed={preference.mode === "rewrite"}
              className={cn(
                "flex min-h-[96px] flex-col items-start gap-1 rounded-xl border p-4 text-left",
                preference.mode === "rewrite"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-accent/40",
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Copy className="h-4 w-4" /> Reescrever
              </span>
              <span className="text-sm text-muted-foreground">
                Veja o texto e escreva a mesma frase no mesmo idioma.
              </span>
            </button>
          </div>

          {preference.mode === "rewrite" && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div>
                <p className="font-medium">Qual lado será reescrito?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A configuração de direção da tradução não interfere nesta atividade.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant={preference.rewriteSide === "a" ? "default" : "outline"}
                  aria-pressed={preference.rewriteSide === "a"}
                  onClick={() => updateSide("a")}
                  className="min-h-[44px] min-w-0"
                >
                  <span className="truncate">Somente {playRuntime.labelA}</span>
                </Button>
                <Button
                  type="button"
                  variant={preference.rewriteSide === "b" ? "default" : "outline"}
                  aria-pressed={preference.rewriteSide === "b"}
                  onClick={() => updateSide("b")}
                  className="min-h-[44px] min-w-0"
                >
                  <span className="truncate">Somente {playRuntime.labelB}</span>
                </Button>
                <Button
                  type="button"
                  variant={preference.rewriteSide === "alternating" ? "default" : "outline"}
                  aria-pressed={preference.rewriteSide === "alternating"}
                  onClick={() => updateSide("alternating")}
                  className="min-h-[44px] min-w-0"
                >
                  <Shuffle className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Alternar</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Palavras e ordem continuam sendo cobradas. Pontuação final, acentos, maiúsculas e pequenas variações de teclado seguem as tolerâncias do modo Escrita.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
