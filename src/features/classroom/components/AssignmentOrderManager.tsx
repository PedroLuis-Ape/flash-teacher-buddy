import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ListOrdered, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAtribuicoesByTurma, useReorderAtribuicoes } from '@/features/classroom/hooks/useAtribuicoes';
import {
  assignmentPositionLabel,
  moveAssignmentToPosition,
  sortAssignmentsByOrder,
} from '@/features/classroom/lib/assignmentOrder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AssignmentOrderManagerProps {
  turmaId: string;
}

export function AssignmentOrderManager({ turmaId }: AssignmentOrderManagerProps) {
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const assignmentsQuery = useAtribuicoesByTurma(turmaId);
  const reorderAssignments = useReorderAtribuicoes();

  const assignments = useMemo(
    () => sortAssignmentsByOrder((assignmentsQuery.data?.atribuicoes ?? []) as any[]),
    [assignmentsQuery.data?.atribuicoes],
  );

  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment: any) => [assignment.id, assignment])),
    [assignments],
  );

  const currentIds = useMemo(() => assignments.map((assignment: any) => assignment.id), [assignments]);
  const draftAssignments = draftIds.map((id) => assignmentMap.get(id)).filter(Boolean) as any[];
  const needsNormalization = assignments.some(
    (assignment: any, index: number) => Number(assignment.order_index ?? 0) !== index + 1,
  );
  const hasChanged = draftIds.join('|') !== currentIds.join('|') || needsNormalization;

  useEffect(() => {
    if (open) setDraftIds(currentIds);
  }, [open, currentIds]);

  if (assignments.length === 0) return null;

  const moveToPosition = (assignmentId: string, targetIndex: number) => {
    const base = draftAssignments.length === assignments.length ? draftAssignments : assignments;
    const next = moveAssignmentToPosition(base, assignmentId, targetIndex);
    setDraftIds(next.map((assignment) => assignment.id));
  };

  const saveOrder = async () => {
    const orderedIds = draftIds.length === assignments.length ? draftIds : currentIds;
    try {
      await reorderAssignments.mutateAsync({ turma_id: turmaId, ordered_ids: orderedIds });
      toast.success('Sequência da turma atualizada!');
      setOpen(false);
    } catch (error) {
      console.error('[AssignmentOrderManager] Failed to save order:', error);
      toast.error('Não foi possível salvar a sequência.');
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-24 z-40 gap-2 shadow-lg sm:right-6"
        onClick={() => setOpen(true)}
      >
        <ListOrdered className="h-4 w-4" />
        Organizar sequência
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              Ordem das atividades
            </DialogTitle>
            <DialogDescription>
              Escolha qual conteúdo será 001, 002, 003 e assim por diante. O nome da pasta não interfere mais na prioridade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {draftAssignments.map((assignment: any, index: number) => (
              <div key={assignment.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
                <Select value={String(index)} onValueChange={(value) => moveToPosition(assignment.id, Number(value))}>
                  <SelectTrigger className="h-10 w-24 shrink-0 border-primary/30 font-mono font-bold text-primary" aria-label={`Posição de ${assignment.titulo}`}>
                    <SelectValue>{assignmentPositionLabel(index)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {draftAssignments.map((_item, positionIndex) => (
                      <SelectItem key={positionIndex} value={String(positionIndex)}>
                        {assignmentPositionLabel(positionIndex)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{assignment.titulo}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{assignment.fonte_tipo === 'pasta' ? 'Pasta' : 'Lista'}</Badge>
                    <span className="text-xs text-muted-foreground">{assignment.card_count ?? 0} cards</span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                  <Button type="button" size="icon" variant="outline" disabled={index === 0} onClick={() => moveToPosition(assignment.id, index - 1)} aria-label={`Mover ${assignment.titulo} para cima`}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" disabled={index === draftAssignments.length - 1} onClick={() => moveToPosition(assignment.id, index + 1)} aria-label={`Mover ${assignment.titulo} para baixo`}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" className="gap-2" disabled={!hasChanged || reorderAssignments.isPending} onClick={saveOrder}>
              <Save className="h-4 w-4" />
              {reorderAssignments.isPending ? 'Salvando...' : 'Salvar sequência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
