import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  Target, 
  Play, 
  Pause, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { useGoals, Goal, GoalStep } from "@/hooks/useGoals";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { differenceInDays, format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mode labels
const MODE_LABELS: Record<string, string> = {
  'flip': 'Virar Cartas',
  'write': 'Escrever',
  'multiple-choice': 'Múltipla Escolha',
  'unscramble': 'Desembaralhar',
  'pronunciation': 'Pronúncia',
  'mixed': 'Misto',
};

function GoalCard({ goal, onPause, onResume, onDelete }: {
  goal: Goal;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(goal.status === 'active');

  const steps = goal.steps || [];
  const completedSteps = steps.filter(s => s.current_count >= s.target_count).length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Calculate days remaining
  let daysRemaining: number | null = null;
  let isOverdue = false;
  if (goal.due_at) {
    const dueDate = new Date(goal.due_at);
    if (isPast(dueDate) && goal.status === 'active') {
      isOverdue = true;
      daysRemaining = 0;
    } else {
      daysRemaining = differenceInDays(dueDate, new Date());
    }
  }

  const statusConfig = {
    active: { label: 'Ativa', variant: 'default' as const, icon: Target },
    paused: { label: 'Pausada', variant: 'secondary' as const, icon: Pause },
    completed: { label: 'Concluída', variant: 'default' as const, icon: CheckCircle2 },
    expired: { label: 'Expirada', variant: 'destructive' as const, icon: AlertCircle },
  };

  const { label: statusLabel, variant: statusVariant, icon: StatusIcon } = statusConfig[goal.status];

  const handleGoToStep = (step: GoalStep) => {
    if (step.mode) {
      navigate(`/list/${step.list_id}?mode=${step.mode}`);
    } else {
      navigate(`/list/${step.list_id}`);
    }
  };

  return (
    <Card className={cn(
      "transition-all",
      goal.status === 'completed' && "opacity-75",
      goal.status === 'paused' && "opacity-60"
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold truncate">
                {goal.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={statusVariant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {statusLabel}
                </Badge>
                {daysRemaining !== null && goal.status === 'active' && (
                  <Badge variant={isOverdue ? "destructive" : "outline"} className="gap-1">
                    <Clock className="h-3 w-3" />
                    {isOverdue ? 'Atrasada' : `${daysRemaining}d restantes`}
                  </Badge>
                )}
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{completedSteps} de {totalSteps} etapas</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2 space-y-3">
            {/* Steps list */}
            <div className="space-y-2">
              {steps.map((step, index) => {
                const stepCompleted = step.current_count >= step.target_count;
                return (
                  <div 
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg border",
                      stepCompleted ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                      stepCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {stepCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{step.list_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.mode ? MODE_LABELS[step.mode] || step.mode : 'Modo livre'}
                        {' • '}
                        {step.current_count}/{step.target_count} repetições
                      </p>
                    </div>
                    {!stepCompleted && goal.status === 'active' && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleGoToStep(step)}
                        className="shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            {goal.status !== 'completed' && (
              <div className="flex items-center gap-2 pt-2 border-t">
                {goal.status === 'active' ? (
                  <Button variant="outline" size="sm" onClick={onPause} className="gap-1">
                    <Pause className="h-3 w-3" />
                    Pausar
                  </Button>
                ) : goal.status === 'paused' && (
                  <Button variant="outline" size="sm" onClick={onResume} className="gap-1">
                    <Play className="h-3 w-3" />
                    Retomar
                  </Button>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1">
                      <Trash2 className="h-3 w-3" />
                      Apagar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar meta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. A meta e todo o progresso serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Apagar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Date info */}
            <div className="text-xs text-muted-foreground pt-1">
              Criada em {format(new Date(goal.created_at), "d 'de' MMMM", { locale: ptBR })}
              {goal.due_at && (
                <> • Prazo: {format(new Date(goal.due_at), "d 'de' MMMM", { locale: ptBR })}</>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function Goals() {
  const navigate = useNavigate();
  const { goals, isLoading, updateGoalStatus, deleteGoal } = useGoals();

  const activeGoals = goals.filter(g => g.status === 'active');
  const pausedGoals = goals.filter(g => g.status === 'paused');
  const completedGoals = goals.filter(g => g.status === 'completed' || g.status === 'expired');

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <ApeAppBar title="Metas" showBack />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Carregando metas..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <ApeAppBar 
        title="Metas" 
        showBack
        rightContent={
          <Button 
            size="sm" 
            onClick={() => navigate('/goals/new')}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Nova
          </Button>
        }
      />

      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        {/* Empty state */}
        {goals.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Nenhuma meta ainda</h2>
            <p className="text-muted-foreground mb-6">
              Crie metas para organizar seus estudos e acompanhar seu progresso.
            </p>
            <Button onClick={() => navigate('/goals/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira meta
            </Button>
          </div>
        )}

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Metas Ativas ({activeGoals.length})
            </h2>
            <div className="space-y-3">
              {activeGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPause={() => updateGoalStatus(goal.id, 'paused')}
                  onResume={() => updateGoalStatus(goal.id, 'active')}
                  onDelete={() => deleteGoal(goal.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Paused goals */}
        {pausedGoals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Pausadas ({pausedGoals.length})
            </h2>
            <div className="space-y-3">
              {pausedGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPause={() => updateGoalStatus(goal.id, 'paused')}
                  onResume={() => updateGoalStatus(goal.id, 'active')}
                  onDelete={() => deleteGoal(goal.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed/Expired goals */}
        {completedGoals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Concluídas ({completedGoals.length})
            </h2>
            <div className="space-y-3">
              {completedGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPause={() => {}}
                  onResume={() => {}}
                  onDelete={() => deleteGoal(goal.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
