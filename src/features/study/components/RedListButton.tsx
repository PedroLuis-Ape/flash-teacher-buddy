import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToggleRedList } from '@/hooks/useRedList';
import { useGroupStatusGate } from '@/features/cards/hooks/useGroupStatusGate';
import { useSetFlashcardGroupStatus } from '@/features/cards/hooks/useFlashcardGroupStatus';

interface RedListButtonProps {
  flashcardId: string;
  isFavorite: boolean;
  isRedListed: boolean;
  size?: 'sm' | 'default';
  className?: string;
  /**
   * Clara Master Phase 5.b — when provided AND the `new_status_pipeline`
   * feature flag is `"shadow"` or `"on"`, the button routes through the
   * stable group-status pipeline. When omitted, behaviour is byte-identical
   * to the legacy code path.
   */
  statusGroupUid?: string | null;
}

export function RedListButton({
  flashcardId,
  isFavorite,
  isRedListed,
  size = 'default',
  className,
  statusGroupUid,
}: RedListButtonProps) {
  const toggleRedList = useToggleRedList();
  const setGroupStatus = useSetFlashcardGroupStatus();
  const gate = useGroupStatusGate({
    statusGroupUid,
    legacyIsFavorite: isFavorite,
    legacyIsRedList: isRedListed,
  });

  // Red list only available for favorites (CHECK invariant on the new model).
  if (!gate.effectiveIsFavorite) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (gate.mode === 'new' && statusGroupUid) {
      setGroupStatus.mutate({
        statusGroupUid,
        isFavorite: true, // CHECK: red implies favorite
        isRedList: !gate.effectiveIsRedList,
      });
      return;
    }
    toggleRedList.mutate({ flashcardId, isRedListed });
  };

  const effectiveIsRedListed = gate.effectiveIsRedList;
  const isPending = gate.mode === 'new' ? setGroupStatus.isPending : toggleRedList.isPending;

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'sm'}
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'transition-colors',
        effectiveIsRedListed
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500',
        size === 'sm' && 'h-8 w-8',
        className
      )}
      title={
        effectiveIsRedListed
          ? 'Remover da Lista Vermelha'
          : 'Adicionar à Lista Vermelha (prioridade)'
      }
    >
      <Flame className={cn('h-4 w-4', effectiveIsRedListed && 'fill-current')} />
    </Button>
  );
}
