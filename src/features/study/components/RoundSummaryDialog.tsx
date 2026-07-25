import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCcw, ArrowLeft, Trophy } from "lucide-react";
import type { RoundSummary } from "@/features/study/lib/studySessionFlow";

interface RoundSummaryDialogProps {
  open: boolean;
  summary: RoundSummary | null;
  onNextRound: () => void;
  onExit: () => void;
}

/**
 * Popup that appears at the end of every 15-card mastery round. Shows the
 * user how many they nailed on the first try, how many they recovered, and
 * how many are still pending review before starting the next round.
 */
export function RoundSummaryDialog({ open, summary, onNextRound, onExit }: RoundSummaryDialogProps) {
  if (!summary) return null;

  const {
    roundNumber,
    cardsPlayed,
    correctFirstTry,
    recoveredCards,
    incorrectCards,
    pendingReview,
    unseenRemaining,
  } = summary;

  return (
    <Dialog open={open} onOpenChange={() => { /* controlled — advance via buttons */ }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/40">
            <Trophy className="h-8 w-8 text-amber-500" />
          </div>
          <DialogTitle className="text-xl">Rodada {roundNumber} concluída!</DialogTitle>
          <DialogDescription>
            Você jogou {cardsPlayed} card{cardsPlayed === 1 ? "" : "s"} nesta rodada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-green-600">{correctFirstTry}</div>
            <div className="text-xs text-muted-foreground">Acertos</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-amber-600">{recoveredCards}</div>
            <div className="text-xs text-muted-foreground">Recuperados</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-destructive">{incorrectCards}</div>
            <div className="text-xs text-muted-foreground">Errados</div>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Para revisar</span>
            <span className="font-semibold">{pendingReview}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cards novos restantes</span>
            <span className="font-semibold">{unseenRemaining}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onNextRound} className="w-full min-h-[48px] text-base font-bold">
            <RefreshCcw className="mr-2 h-5 w-5" />
            Iniciar próxima rodada
          </Button>
          <Button variant="ghost" onClick={onExit} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Sair do estudo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}