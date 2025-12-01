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
    mutationFn: async ({ flashcardId, isFavorite }: { flashcardId: string; isFavorite: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      
      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('flashcard_id', flashcardId);
        
        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: user.id, flashcard_id: flashcardId });
        
        if (error) throw error;
      }
      
      return { flashcardId, isFavorite: !isFavorite };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success(data.isFavorite ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos');
    },
    onError: (error) => {
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao atualizar favorito');
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