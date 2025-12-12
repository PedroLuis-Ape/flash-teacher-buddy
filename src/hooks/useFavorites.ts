import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FavoriteResourceType = 'flashcard' | 'list' | 'folder';

export function useFavorites(userId: string | undefined, resourceType: FavoriteResourceType) {
  return useQuery({
    queryKey: ['favorites', userId, resourceType],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('resource_id')
        .eq('user_id', userId)
        .eq('resource_type', resourceType);
      
      if (error) throw error;
      return data?.map(f => f.resource_id) || [];
    },
    enabled: !!userId,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      resourceId, 
      resourceType, 
      isFavorite 
    }: { 
      resourceId: string; 
      resourceType: FavoriteResourceType;
      isFavorite: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      
      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('resource_type', resourceType)
          .eq('resource_id', resourceId);
        
        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({ 
            user_id: user.id, 
            resource_type: resourceType,
            resource_id: resourceId 
          });
        
        if (error) throw error;
      }
      
      return { resourceId, resourceType, isFavorite: !isFavorite, userId: user.id };
    },
    
    // Optimistic update
    onMutate: async ({ resourceId, resourceType, isFavorite }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await queryClient.cancelQueries({ queryKey: ['favorites', user.id, resourceType] });

      const previousFavorites = queryClient.getQueryData<string[]>(['favorites', user.id, resourceType]);

      queryClient.setQueryData<string[]>(['favorites', user.id, resourceType], (old = []) => {
        if (isFavorite) {
          return old.filter(id => id !== resourceId);
        } else {
          return [...old, resourceId];
        }
      });

      return { previousFavorites, userId: user.id, resourceType };
    },

    onError: (error, _variables, context) => {
      if (context?.userId && context?.previousFavorites !== undefined && context?.resourceType) {
        queryClient.setQueryData(
          ['favorites', context.userId, context.resourceType], 
          context.previousFavorites
        );
      }
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao sincronizar favorito');
    },
    
    onSuccess: (data) => {
      toast.success(data.isFavorite ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos');
    },

    onSettled: (_data, _error, _variables, context) => {
      if (context?.userId && context?.resourceType) {
        queryClient.invalidateQueries({ queryKey: ['favorites', context.userId, context.resourceType] });
      }
    },
  });
}

export function useFavoritesCount(userId: string | undefined, resourceType: FavoriteResourceType) {
  return useQuery({
    queryKey: ['favorites-count', userId, resourceType],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { count, error } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('resource_type', resourceType);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });
}

// Helper hook for flashcard favorites (backwards compatibility)
export function useFlashcardFavorites(userId: string | undefined) {
  return useFavorites(userId, 'flashcard');
}
