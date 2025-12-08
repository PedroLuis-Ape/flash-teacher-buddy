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
      
      return { flashcardId, isFavorite: !isFavorite, userId: user.id };
    },
    
    // Optimistic update - atualiza a UI imediatamente
    onMutate: async ({ flashcardId, isFavorite }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cancela refetches em andamento
      await queryClient.cancelQueries({ queryKey: ['favorites', user.id] });

      // Salva o estado anterior
      const previousFavorites = queryClient.getQueryData<string[]>(['favorites', user.id]);

      // Atualiza o cache manualmente
      queryClient.setQueryData<string[]>(['favorites', user.id], (old = []) => {
        if (isFavorite) {
          return old.filter(id => id !== flashcardId);
        } else {
          return [...old, flashcardId];
        }
      });

      return { previousFavorites, userId: user.id };
    },

    onError: (error, _variables, context) => {
      // Reverte para o estado anterior em caso de erro
      if (context?.userId && context?.previousFavorites !== undefined) {
        queryClient.setQueryData(['favorites', context.userId], context.previousFavorites);
      }
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao sincronizar favorito');
    },
    
    onSuccess: (data) => {
      toast.success(data.isFavorite ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos');
    },

    onSettled: (_data, _error, _variables, context) => {
      // Refetch para garantir consistência
      if (context?.userId) {
        queryClient.invalidateQueries({ queryKey: ['favorites', context.userId] });
      }
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