import { useState } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";
import type {
  StudyWriteActivityModePreset,
  StudyWriteRewriteSidePreset,
} from "@/features/study/preferences/studyPreset";

interface WriteActivitySettingsProps {
  /** Valores efetivamente usados pela sessão — vindos do controlador único. */
  activityMode: StudyWriteActivityModePreset;
  rewriteSide: StudyWriteRewriteSidePreset;
  onChange: (patch: {
    writeActivityMode?: StudyWriteActivityModePreset;
    writeRewriteSide?: StudyWriteRewriteSidePreset;
  }) => void;
}

/**
 * Componente controlado: mantém apenas estado de interface (seção expandida).
 * Não hidrata preferências e não escreve preset por conta própria.
 */
export function WriteActivitySettings({
  activityMode,
  rewriteSide,
  onChange,
}: WriteActivitySettingsProps) {
  const playRuntime = usePlayPresetRuntime();
  const [expanded, setExpanded] = useState(false);

  const sideSummary = rewriteSide === "a"
    ? playRuntime.labelA
    : rewriteSide === "b"
      ? playRuntime.labelB
      : "alternando os lados";
  const summary = activityMode === "translate"
    ? "Traduzir de um lado para o outro"
    : `Reescrever · ${sideSummary}`;

  const sideOptions: { value: StudyWriteRewriteSidePreset; label: string }[] = [
    { value: "a", label: playRuntime.labelA },
    { value: "b", label: playRuntime.labelB },
    { value: "alternating", label: "Alternar" },
  ];

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
            <Button
              type="button"
              variant={activityMode === "translate" ? "default" : "outline"}
              aria-pressed={activityMode === "translate"}
              onClick={() => onChange({ writeActivityMode: "translate" })}
              className="min-h-[44px]"
            >
              Traduzir
            </Button>
            <Button
              type="button"
              variant={activityMode === "rewrite" ? "default" : "outline"}
              aria-pressed={activityMode === "rewrite"}
              onClick={() => onChange({ writeActivityMode: "rewrite" })}
              className="min-h-[44px]"
            >
              Reescrever
            </Button>
          </div>

          {activityMode === "rewrite" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Qual lado você quer reescrever?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {sideOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={rewriteSide === option.value ? "secondary" : "outline"}
                    aria-pressed={rewriteSide === option.value}
                    onClick={() => onChange({ writeRewriteSide: option.value })}
                    className="min-h-[44px] min-w-0"
                  >
                    <span className="truncate">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
