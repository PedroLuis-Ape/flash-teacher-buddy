import { Trophy, RotateCcw, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
}: StudyCompletionModalProps) => {
  const accuracy = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Trophy className="h-8 w-8 text-primary" />
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
            onClick={onComplete}
            className="w-full bg-green-600 hover:bg-green-700 text-lg font-bold min-h-[48px]"
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            CONCLUIR SESSÃO
          </Button>

          <Button variant="secondary" onClick={onRestart} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            Jogar Novamente
          </Button>

          {onReviewErrors && errorCount > 0 && (
            <Button variant="outline" onClick={onReviewErrors} className="w-full">
              Rever Errados ({errorCount})
            </Button>
          )}

          {fromGoalId && onGoToGoals && (
            <Button variant="outline" onClick={onGoToGoals} className="w-full">
              ← Voltar para Metas
            </Button>
          )}

          <Button variant="ghost" onClick={onExit} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar à Lista
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
