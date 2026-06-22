import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
}: StudyFeedbackPanelProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const showAnswers = Boolean(userAnswer || correctAnswer);

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

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/30 p-1 shadow-sm sm:h-[4.5rem] sm:w-[4.5rem]">
            <img
              src={config.mascot}
              alt={config.mascotAlt}
              className="h-full w-full object-contain drop-shadow-md"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", config.iconClass)}>
                <StatusIcon className="h-[1.125rem] w-[1.125rem]" />
              </span>
              <h3 className={cn("text-base font-extrabold leading-tight sm:text-lg", config.titleClass)}>
                {title ?? config.title}
              </h3>
            </div>

            {message && (
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {message}
              </div>
            )}

            {showAnswers && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {userAnswer && (
                  <div className={cn("min-w-0 rounded-xl border p-3", config.answerClass)}>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {userAnswerLabel}
                    </span>
                    <p className={cn("mt-1 break-words text-sm font-semibold text-foreground", status === "incorrect" && "line-through decoration-destructive/70")}>
                      {userAnswer}
                    </p>
                  </div>
                )}

                {correctAnswer && (
                  <div className="min-w-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {correctAnswerLabel}
                    </span>
                    <p className="mt-1 break-words text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                      {correctAnswer}
                    </p>
                  </div>
                )}
              </div>
            )}

            {acceptedAnswers.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Outras respostas aceitas: <span className="font-semibold text-foreground">{acceptedAnswers.join(", ")}</span>
              </p>
            )}
          </div>
        </div>

        {actionLabel && onAction && (
          <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:w-44">
            <Button
              type="button"
              size="lg"
              onClick={onAction}
              className={cn("h-11 w-full gap-2 rounded-xl font-bold shadow-sm", config.buttonClass)}
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {actionHint && (
              <p className="text-center text-[10px] leading-tight text-muted-foreground" aria-live="polite">
                {actionHint}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
