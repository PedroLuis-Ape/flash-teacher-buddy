import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorites', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('flashcard_id')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data?.map(f => f.flashcard_id) || [];
    },
    enabled: !!userId,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ flashcardId, isFavorite, userId }: { flashcardId: string; isFavorite: boolean; userId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = userId || user?.id;
      if (!effectiveUserId) throw new Error('Não autenticado');
      
      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', effectiveUserId)
          .eq('flashcard_id', flashcardId);
        
        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: effectiveUserId, flashcard_id: flashcardId });
        
        if (error) throw error;
      }
      
      return { flashcardId, isFavorite: !isFavorite, userId: effectiveUserId };
    },
    // Optimistic update to prevent screen flicker
    onMutate: async ({ flashcardId, isFavorite, userId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      
      // Snapshot the previous value
      const previousFavorites = queryClient.getQueryData<string[]>(['favorites', userId]);
      
      // Optimistically update the cache
      queryClient.setQueryData<string[]>(['favorites', userId], (old = []) => {
        if (isFavorite) {
          // Removing: filter out the flashcard
          return old.filter(id => id !== flashcardId);
        } else {
          // Adding: append the flashcard
          return [...old, flashcardId];
        }
      });
      
      return { previousFavorites, userId };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousFavorites !== undefined) {
        queryClient.setQueryData(['favorites', context.userId], context.previousFavorites);
      }
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao atualizar favorito');
    },
    onSuccess: (data) => {
      toast.success(data.isFavorite ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos');
    },
    onSettled: (_data, _error, variables) => {
      // Refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['favorites', variables.userId] });
    },
  });
}

export function useFavoritesCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorites-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { count, error } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });
}