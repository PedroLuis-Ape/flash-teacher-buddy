import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RedListIndicatorProps {
  isRedListed: boolean;
  isFavorite: boolean;
  onToggleRedList?: () => void;
  size?: 'sm' | 'default';
  className?: string;
}

/**
 * Inline button to toggle red-list status during study.
 * Only visible when the card is a favorite.
 */
export function RedListIndicator({
  isRedListed,
  isFavorite,
  onToggleRedList,
  size = 'default',
  className,
}: RedListIndicatorProps) {
  if (!isFavorite || !onToggleRedList) return null;

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'sm'}
      onClick={(e) => {
        e.stopPropagation();
        onToggleRedList();
      }}
      className={cn(
        'transition-colors',
        isRedListed
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500',
        size === 'sm' && 'h-8 w-8',
        className
      )}
      title={
        isRedListed
          ? 'Remover da Lista Vermelha'
          : 'Adicionar à Lista Vermelha'
      }
    >
      <Flame className={cn('h-4 w-4', isRedListed && 'fill-current')} />
    </Button>
  );
}

/**
 * Returns className for red-list card highlight border.
 */
export function getRedListCardClass(isRedListed: boolean): string {
  if (!isRedListed) return '';
  return 'ring-2 ring-red-500/60 shadow-[0_0_12px_-3px_rgba(239,68,68,0.4)]';
}
