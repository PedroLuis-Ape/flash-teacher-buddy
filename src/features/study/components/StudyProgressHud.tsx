import { BarChart3, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { StudyProgressMetrics } from "@/features/study/lib/studyProgressMetrics";
import { cn } from "@/lib/utils";

type StudyProgressHudProps = {
  metrics: StudyProgressMetrics;
  overallTotal: number;
  currentRoundTotal: number;
  roundNumber: number;
  isMasteryMode: boolean;
  correctCount: number;
  errorCount: number;
  skippedCount: number;
  pendingReview?: number;
  unseenRemaining?: number;
  className?: string;
};

const ScoreLine = ({
  correctCount,
  errorCount,
  skippedCount,
  className,
}: Pick<StudyProgressHudProps, "correctCount" | "errorCount" | "skippedCount" | "className">) => (
  <div className={cn("flex shrink-0 items-center gap-3 font-semibold tabular-nums", className)}>
    <span className="text-success" title="Acertos">✓ {correctCount}</span>
    <span className="text-destructive" title="Erros">✗ {errorCount}</span>
    <span className="text-warning" title="Pulados">⊘ {skippedCount}</span>
  </div>
);

/**
 * Compact two-level progress HUD.
 *
 * The only persistent bar represents the whole effective session. Round data
 * stays textual so adding global progress does not grow the study screen.
 */
export function StudyProgressHud({
  metrics,
  overallTotal,
  currentRoundTotal,
  roundNumber,
  isMasteryMode,
  correctCount,
  errorCount,
  skippedCount,
  pendingReview = 0,
  unseenRemaining = 0,
  className,
}: StudyProgressHudProps) {
  const roundedOverallPercent = Math.round(metrics.overallPercent);
  const roundedRoundPercent = Math.round(metrics.roundPercent);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/90 px-3 py-2 shadow-sm backdrop-blur",
        className,
      )}
      data-testid="study-progress-hud"
    >
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Abrir detalhes do progresso geral: ${roundedOverallPercent}%`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="hidden xs:inline">Geral</span>
              <strong className="tabular-nums text-foreground">{roundedOverallPercent}%</strong>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3 p-4">
            <div>
              <p className="font-semibold">Progresso da sessão</p>
              <p className="text-xs text-muted-foreground">
                {isMasteryMode
                  ? "Conta apenas cards únicos já dominados."
                  : "Acompanha sua posição no baralho efetivo desta sessão."}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>{isMasteryMode ? "Dominados" : "Percorridos"}</span>
                <strong className="tabular-nums">
                  {metrics.overallCompleted} / {overallTotal}
                </strong>
              </div>
              <Progress value={metrics.overallPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/60 p-2">
                <span className="block text-muted-foreground">Restantes</span>
                <strong className="text-base tabular-nums">{metrics.overallRemaining}</strong>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <span className="block text-muted-foreground">Rodada atual</span>
                <strong className="text-base tabular-nums">
                  {metrics.roundPosition} / {currentRoundTotal}
                </strong>
              </div>
              {isMasteryMode && (
                <>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <span className="block text-muted-foreground">Para revisar</span>
                    <strong className="text-base tabular-nums">{pendingReview}</strong>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <span className="block text-muted-foreground">Ainda inéditos</span>
                    <strong className="text-base tabular-nums">{unseenRemaining}</strong>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Progress
          value={metrics.overallPercent}
          className="h-1.5 min-w-0 flex-1"
          aria-label={`Progresso geral: ${roundedOverallPercent}%`}
        />

        <ScoreLine
          correctCount={correctCount}
          errorCount={errorCount}
          skippedCount={skippedCount}
          className="hidden text-xs sm:flex"
        />
      </div>

      <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate font-medium tabular-nums text-foreground">
          {isMasteryMode
            ? `Rodada ${roundNumber} · ${metrics.roundPosition}/${currentRoundTotal}`
            : `${metrics.roundPosition}/${currentRoundTotal} cards`}
          <span className="ml-1 text-muted-foreground">· {roundedRoundPercent}%</span>
        </span>

        {isMasteryMode && (
          <span className="hidden truncate tabular-nums sm:inline">
            {metrics.overallCompleted}/{overallTotal} dominados
          </span>
        )}

        <ScoreLine
          correctCount={correctCount}
          errorCount={errorCount}
          skippedCount={skippedCount}
          className="text-[11px] sm:hidden"
        />
      </div>
    </div>
  );
}
