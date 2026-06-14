import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToggleFavorite, FavoriteResourceType } from '@/hooks/useFavorites';
import { useGroupStatusGate } from '@/features/cards/hooks/useGroupStatusGate';
import { useSetFlashcardGroupStatus } from '@/features/cards/hooks/useFlashcardGroupStatus';

interface FavoriteButtonProps {
  resourceId: string;
  resourceType?: FavoriteResourceType;
  isFavorite: boolean;
  size?: 'sm' | 'default';
  className?: string;
  /**
   * Clara Master Phase 5.b — when provided AND the `new_status_pipeline`
   * feature flag is `"shadow"` or `"on"`, the button routes through the
   * stable group-status pipeline. When omitted, behaviour is byte-identical
   * to the legacy code path.
   */
  statusGroupUid?: string | null;
  /**
   * Optional current red-list state, only consulted when the new pipeline is
   * active (writing a favorite OFF must also clear red-list — Phase 3 CHECK).
   */
  isRedListed?: boolean;
}

export function FavoriteButton({ 
  resourceId, 
  resourceType = 'flashcard', 
  isFavorite, 
  size = 'default', 
  className,
  statusGroupUid,
  isRedListed = false,
}: FavoriteButtonProps) {
  const toggleFavorite = useToggleFavorite();
  const setGroupStatus = useSetFlashcardGroupStatus();
  const gate = useGroupStatusGate({
    statusGroupUid,
    legacyIsFavorite: isFavorite,
    legacyIsRedList: isRedListed,
  });

  const effectiveIsFavorite = gate.effectiveIsFavorite;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (gate.mode === 'new' && statusGroupUid) {
      const nextFav = !effectiveIsFavorite;
      setGroupStatus.mutate({
        statusGroupUid,
        isFavorite: nextFav,
        // Removing favorite forces red off (CHECK invariant).
        isRedList: nextFav ? gate.effectiveIsRedList : false,
      });
      return;
    }
    toggleFavorite.mutate({ resourceId, resourceType, isFavorite });
  };

  const isPending = gate.mode === 'new' ? setGroupStatus.isPending : toggleFavorite.isPending;
  
  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'sm'}
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'transition-colors',
        effectiveIsFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500',
        size === 'sm' && 'h-8 w-8',
        className
      )}
      title={effectiveIsFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      <Star className={cn('h-4 w-4', effectiveIsFavorite && 'fill-current')} />
    </Button>
  );
}
