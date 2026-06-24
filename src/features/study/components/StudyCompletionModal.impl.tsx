import { useEffect, useRef } from "react";
import { RotateCcw, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { playNext, playRound } from "@/lib/sfx";

interface StudyCompletionModalProps {
  open: boolean;
  correctCount: number;
  errorCount: number;
  skippedCount: number;
  totalCards: number;
  onComplete: () => void;
  onRestart: () => void;
  onReviewErrors?: () => void;
  onExit: () => void;
  onOpenChange: (open: boolean) => void;
  fromGoalId?: string | null;
  onGoToGoals?: () => void;
  isCompleting?: boolean;
  isRestarting?: boolean;
}

export const StudyCompletionModal = ({
  open,
  correctCount,
  errorCount,
  skippedCount,
  totalCards,
  onComplete,
  onRestart,
  onReviewErrors,
  onExit,
  onOpenChange,
  fromGoalId,
  onGoToGoals,
  isCompleting = false,
  isRestarting = false,
}: StudyCompletionModalProps) => {
  const accuracy = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      playRound();
    }
    wasOpenRef.current = open;
  }, [open]);

  const runTransition = (action: () => void) => {
    playNext();
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300/25 via-yellow-400/10 to-orange-500/20 shadow-[0_16px_36px_-16px_rgba(245,158,11,0.9)] ring-1 ring-amber-300/30">
            <span role="img" aria-label="Troféu" className="select-none text-5xl leading-none drop-shadow-[0_7px_7px_rgba(0,0,0,0.4)]">🏆</span>
          </div>
          <DialogTitle className="text-xl">Atividade Concluída!</DialogTitle>
          <DialogDescription>
            Você completou todos os {totalCards} cards desta sessão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-green-600">{correctCount}</div>
            <div className="text-xs text-muted-foreground">Acertos</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-muted-foreground">{skippedCount}</div>
            <div className="text-xs text-muted-foreground">Pulados</div>
          </div>
        </div>

        {accuracy > 0 && (
          <div className="text-center text-sm text-muted-foreground pb-2">
            Precisão: <span className="font-semibold text-foreground">{accuracy}%</span>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => runTransition(onComplete)}
            disabled={isCompleting || isRestarting}
            className="w-full bg-green-600 hover:bg-green-700 text-lg font-bold min-h-[48px]"
          >
            {isCompleting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
            {isCompleting ? "CONCLUINDO..." : "CONCLUIR SESSÃO"}
          </Button>

          <Button variant="secondary" onClick={() => runTransition(onRestart)} disabled={isCompleting || isRestarting} className="w-full">
            {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {isRestarting ? "Reiniciando..." : "Jogar Novamente"}
          </Button>

          {onReviewErrors && errorCount > 0 && (
            <Button variant="outline" onClick={() => runTransition(onReviewErrors)} className="w-full">
              Rever Errados ({errorCount})
            </Button>
          )}

          {fromGoalId && onGoToGoals && (
            <Button variant="outline" onClick={() => runTransition(onGoToGoals)} className="w-full">
              ← Voltar para Metas
            </Button>
          )}

          <Button variant="ghost" onClick={() => runTransition(onExit)} disabled={isCompleting || isRestarting} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar à Lista
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
