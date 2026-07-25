import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Volume2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { playNext } from "@/lib/sfx";
import pitecoHappy from "@/assets/piteco-happy.png";
import pitecoSad from "@/assets/piteco-sad.png";

export type StudyFeedbackStatus = "correct" | "almost" | "incorrect";

interface StudyFeedbackPanelProps {
  status: StudyFeedbackStatus;
  title?: string;
  message?: ReactNode;
  userAnswer?: string | null;
  correctAnswer?: string | null;
  acceptedAnswers?: string[];
  userAnswerLabel?: string;
  correctAnswerLabel?: string;
  actionLabel?: string;
  actionHint?: string;
  onAction?: () => void;
  className?: string;
  onPlayAnswer?: () => void;
  isPlayingAnswer?: boolean;
  playAnswerAriaLabel?: string;
  /** Renderiza um bloco livre acima das respostas (ex: diff palavra a palavra). */
  extraContent?: ReactNode;
  /** Lista de mensagens objetivas de correção. */
  correctionMessages?: string[];
  /** Quando > 0, mostra "E mais N diferenças." */
  hiddenCorrectionCount?: number;
  /** 0..100 — se fornecido, aparece como badge no cabeçalho. */
  accuracyPercent?: number;
}

const STATUS_CONFIG = {
  correct: {
    title: "Muito bem!",
    icon: CheckCircle2,
    mascot: pitecoHappy,
    mascotAlt: "Piteco feliz",
    panelClass: "border-emerald-500/40 border-l-4 border-l-emerald-500",
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    titleClass: "text-emerald-700 dark:text-emerald-300",
    answerClass: "border-emerald-500/25 bg-emerald-500/10",
    buttonClass: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  almost: {
    title: "Quase perfeito!",
    icon: AlertTriangle,
    mascot: pitecoHappy,
    mascotAlt: "Piteco feliz e encorajador",
    panelClass: "border-amber-500/40 border-l-4 border-l-amber-500",
    iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    titleClass: "text-amber-700 dark:text-amber-300",
    answerClass: "border-amber-500/25 bg-amber-500/10",
    buttonClass: "bg-amber-600 text-white hover:bg-amber-700",
  },
  incorrect: {
    title: "Quase! Vamos corrigir.",
    icon: XCircle,
    mascot: pitecoSad,
    mascotAlt: "Piteco triste",
    panelClass: "border-destructive/40 border-l-4 border-l-destructive",
    iconClass: "bg-destructive/10 text-destructive",
    titleClass: "text-destructive",
    answerClass: "border-destructive/20 bg-destructive/10",
    buttonClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
} as const;

export function StudyFeedbackPanel({
  status,
  title,
  message,
  userAnswer,
  correctAnswer,
  acceptedAnswers = [],
  userAnswerLabel = "Você respondeu",
  correctAnswerLabel = "Resposta correta",
  actionLabel,
  actionHint,
  onAction,
  className,
  onPlayAnswer,
  isPlayingAnswer = false,
  playAnswerAriaLabel,
  extraContent,
  correctionMessages,
  hiddenCorrectionCount = 0,
  accuracyPercent,
}: StudyFeedbackPanelProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const showAnswers = Boolean(userAnswer || correctAnswer);

  const handleAction = () => {
    playNext();
    onAction?.();
  };

  return (
    <Card
      role="status"
      aria-live="polite"
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-card p-4 shadow-sm animate-fade-in sm:p-5",
        config.panelClass,
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-muted/25" />

      <div className="relative flex flex-col gap-4">
        {/* Header: mascot + title/message */}
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/30 p-1 shadow-sm sm:h-16 sm:w-16">
            <img
              src={config.mascot}
              alt={config.mascotAlt}
              className="h-full w-full object-contain drop-shadow-md"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", config.iconClass)}>
                <StatusIcon className="h-4 w-4" />
              </span>
              <h3 className={cn("text-base font-extrabold leading-tight sm:text-lg", config.titleClass)}>
                {title ?? config.title}
              </h3>
              {typeof accuracyPercent === "number" && (
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                    config.answerClass,
                    config.titleClass,
                  )}
                  aria-label={`Acerto ${accuracyPercent}%`}
                >
                  {accuracyPercent}%
                </span>
              )}
            </div>

            {message && (
              <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {message}
              </div>
            )}
          </div>
        </div>

        {extraContent && <div className="w-full">{extraContent}</div>}

        {/* Answers row: full-width, breathes on its own line */}
        {showAnswers && (
          <div className="grid gap-2 sm:grid-cols-2">
            {userAnswer && (
              <div className={cn("min-w-0 rounded-xl border p-3", config.answerClass)}>
                <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {userAnswerLabel}
                </span>
                <p className={cn("mt-1 break-words text-base font-semibold text-foreground", status === "incorrect" && "line-through decoration-destructive/70")}>
                  {userAnswer}
                </p>
              </div>
            )}

            {correctAnswer && (
              <div className="min-w-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {correctAnswerLabel}
                  </span>
                  {onPlayAnswer && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={onPlayAnswer}
                      aria-label={playAnswerAriaLabel ?? "Ouvir resposta correta"}
                      title={playAnswerAriaLabel ?? "Ouvir resposta correta"}
                      aria-pressed={isPlayingAnswer}
                      className={cn(
                        "h-7 w-7 shrink-0 rounded-full text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200",
                        isPlayingAnswer && "bg-emerald-500/20",
                      )}
                    >
                      <Volume2 className={cn("h-4 w-4", isPlayingAnswer && "animate-pulse")} />
                    </Button>
                  )}
                </div>
                <p className="mt-1 break-words text-base font-extrabold leading-snug text-emerald-700 dark:text-emerald-300">
                  {correctAnswer}
                </p>
              </div>
            )}
          </div>
        )}

        {acceptedAnswers.length > 0 && (
          <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
            Outras respostas aceitas: <span className="font-semibold text-foreground">{acceptedAnswers.join(", ")}</span>
          </p>
        )}

        {correctionMessages && correctionMessages.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground">
            {correctionMessages.map((line, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <span className="min-w-0 break-words">{line}</span>
              </li>
            ))}
            {hiddenCorrectionCount > 0 && (
              <li className="pl-4 text-xs italic text-muted-foreground">
                E mais {hiddenCorrectionCount} diferença{hiddenCorrectionCount === 1 ? "" : "s"}.
              </li>
            )}
          </ul>
        )}

        {actionLabel && onAction && (
          <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              size="lg"
              onClick={handleAction}
              className={cn("h-11 w-full gap-2 rounded-xl font-bold shadow-sm sm:w-auto sm:min-w-[12rem]", config.buttonClass)}
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {actionHint && (
              <p className="text-center text-[10px] leading-tight text-muted-foreground sm:text-right" aria-live="polite">
                {actionHint}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
