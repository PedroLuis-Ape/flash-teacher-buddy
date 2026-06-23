import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ListOrdered, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthUser } from '@/hooks/useAuthUser';
import { supabase } from '@/integrations/supabase/client';
import { assignmentPositionLabel, moveAssignmentToPosition } from '@/features/classroom/lib/assignmentOrder';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ListSequenceDialogProps {
  folderId: string;
  triggerClassName?: string;
}

interface OrderedList {
  id: string;
  title: string;
  order_index: number | null;
  created_at: string | null;
}

function sortLists(items: OrderedList[]) {
  return [...items].sort((a, b) => {
    const aOrder = Number(a.order_index ?? 0);
    const bOrder = Number(b.order_index ?? 0);
    const aValid = Number.isFinite(aOrder) && aOrder > 0;
    const bValid = Number.isFinite(bOrder) && bOrder > 0;
    if (aValid && bValid && aOrder !== bOrder) return aOrder - bOrder;
    if (aValid !== bValid) return aValid ? -1 : 1;
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function ListSequenceDialog({ folderId, triggerClassName }: ListSequenceDialogProps) {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);

  const dataQuery = useQuery({
    queryKey: ['folder-list-sequence', folderId, user?.id],
    queryFn: async () => {
      if (!user) return { visible: false, lists: [] as OrderedList[] };

      const { data: folder } = await supabase
        .from('folders')
        .select('owner_id')
        .eq('id', folderId)
        .maybeSingle();

      if (!folder || folder.owner_id !== user.id) {
        return { visible: false, lists: [] as OrderedList[] };
      }

      const { data, error } = await supabase
        .from('lists')
        .select('id, title, order_index, created_at')
        .eq('folder_id', folderId)
        .is('deleted_at', null);

      if (error) throw error;
      return { visible: true, lists: sortLists((data ?? []) as OrderedList[]) };
    },
    enabled: Boolean(user && folderId),
  });

  const lists = dataQuery.data?.lists ?? [];
  const listMap = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
  const currentIds = useMemo(() => lists.map((list) => list.id), [lists]);
  const draftLists = draftIds.map((id) => listMap.get(id)).filter(Boolean) as OrderedList[];
  const normalized = lists.every((list, index) => Number(list.order_index ?? 0) === index + 1);
  const changed = draftIds.join('|') !== currentIds.join('|') || !normalized;

  useEffect(() => {
    if (open) setDraftIds(currentIds);
  }, [open, currentIds]);

  const saveMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(orderedIds.map(async (listId, index) => {
        const { error } = await supabase
          .from('lists')
          .update({ order_index: index + 1 })
          .eq('id', listId)
          .eq('folder_id', folderId);
        if (error) throw error;
      }));
    },
    onSuccess: () => {
      toast.success('Ordem das listas atualizada!');
      setOpen(false);
      navigate(0);
    },
    onError: () => toast.error('Não foi possível salvar a ordem das listas.'),
  });

  if (!dataQuery.data?.visible || lists.length === 0) return null;

  const moveTo = (listId: string, targetIndex: number) => {
    const base = draftLists.length === lists.length ? draftLists : lists;
    const moved = moveAssignmentToPosition(base, listId, targetIndex);
    setDraftIds(moved.map((list) => list.id));
  };

  const orderedIds = draftIds.length === lists.length ? draftIds : currentIds;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'gap-2 whitespace-nowrap',
          triggerClassName ?? 'fixed right-3 top-20 z-40 w-auto max-w-[calc(100vw-1.5rem)] px-3 text-xs shadow-lg sm:right-4 sm:top-24 sm:max-w-none sm:text-sm',
        )}
        onClick={() => setOpen(true)}
      >
        <ListOrdered className="h-4 w-4" />
        Organizar listas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ordem das listas</DialogTitle>
            <DialogDescription>Escolha qual lista será 001, 002, 003 e assim por diante.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {draftLists.map((list, index) => (
              <div key={list.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                <Select value={String(index)} onValueChange={(value) => moveTo(list.id, Number(value))}>
                  <SelectTrigger className="h-10 w-24 font-mono font-bold text-primary">
                    <SelectValue>{assignmentPositionLabel(index)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {draftLists.map((_item, positionIndex) => (
                      <SelectItem key={positionIndex} value={String(positionIndex)}>
                        {assignmentPositionLabel(positionIndex)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="min-w-0 flex-1 break-words font-semibold">{list.title}</p>

                <div className="flex gap-1 self-end sm:self-auto">
                  <Button type="button" size="icon" variant="outline" disabled={index === 0} onClick={() => moveTo(list.id, index - 1)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" disabled={index === draftLists.length - 1} onClick={() => moveTo(list.id, index + 1)}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" className="gap-2" disabled={!changed || saveMutation.isPending} onClick={() => saveMutation.mutate(orderedIds)}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar ordem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
