import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToggleRedList } from '@/hooks/useRedList';

interface RedListButtonProps {
  flashcardId: string;
  isFavorite: boolean;
  isRedListed: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function RedListButton({
  flashcardId,
  isFavorite,
  isRedListed,
  size = 'default',
  className,
}: RedListButtonProps) {
  const toggleRedList = useToggleRedList();

  // Red list only available for favorites
  if (!isFavorite) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleRedList.mutate({ flashcardId, isRedListed });
  };

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'sm'}
      onClick={handleClick}
      disabled={toggleRedList.isPending}
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
          : 'Adicionar à Lista Vermelha (prioridade)'
      }
    >
      <Flame className={cn('h-4 w-4', isRedListed && 'fill-current')} />
    </Button>
  );
}
