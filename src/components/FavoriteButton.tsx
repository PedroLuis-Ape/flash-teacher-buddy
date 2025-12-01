import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToggleFavorite } from '@/hooks/useFavorites';

interface FavoriteButtonProps {
  flashcardId: string;
  isFavorite: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function FavoriteButton({ flashcardId, isFavorite, size = 'default', className }: FavoriteButtonProps) {
  const toggleFavorite = useToggleFavorite();
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite.mutate({ flashcardId, isFavorite });
  };
  
  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'sm'}
      onClick={handleClick}
      disabled={toggleFavorite.isPending}
      className={cn(
        'transition-colors',
        isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500',
        size === 'sm' && 'h-8 w-8',
        className
      )}
      title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
    </Button>
  );
}