import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { removeFromRedListIfNeeded } from '@/hooks/useRedList';

export type FavoriteResourceType = 'flashcard' | 'list' | 'folder';

export interface FavoriteScope {
  listId?: string;
  collectionId?: string;
  folderId?: string;
  institutionId?: string;
}

const hasScope = (scope?: FavoriteScope) =>
  Boolean(scope?.listId || scope?.collectionId || scope?.folderId || scope?.institutionId);

async function resolveScopedFlashcardIds(scope: FavoriteScope): Promise<string[]> {
  if (!hasScope(scope)) return [];

  // Primary scope: list or collection
  if (scope.listId || scope.collectionId) {
    let flashcardsQuery = supabase
      .from('flashcards')
      .select('id, parent_card_id')
      .is('deleted_at', null);

    if (scope.listId) {
      flashcardsQuery = flashcardsQuery.eq('list_id', scope.listId);
    }

    if (scope.collectionId) {
      flashcardsQuery = flashcardsQuery.eq('collection_id', scope.collectionId);
    }

    const { data: flashcards, error } = await flashcardsQuery;
    if (error) throw error;

    // Include parent_card_id of layered cards so favorites saved on the
    // group/aggregator id are also counted as scoped favorites.
    const set = new Set<string>();
    for (const card of flashcards ?? []) {
      if (card.id) set.add(card.id);
      if ((card as any).parent_card_id) set.add((card as any).parent_card_id);
    }
    return Array.from(set);
  }

  // Secondary scope: folder / institution -> resolve lists first
  let listsQuery = supabase
    .from('lists')
    .select('id')
    .is('deleted_at', null);

  if (scope.folderId) {
    listsQuery = listsQuery.eq('folder_id', scope.folderId);
  }

  if (scope.institutionId) {
    listsQuery = listsQuery.eq('institution_id', scope.institutionId);
  }

  const { data: lists, error: listsError } = await listsQuery;
  if (listsError) throw listsError;

  const listIds = lists?.map((list) => list.id) ?? [];
  if (listIds.length === 0) return [];

  const { data: flashcards, error: flashcardsError } = await supabase
    .from('flashcards')
    .select('id, parent_card_id')
    .in('list_id', listIds)
    .is('deleted_at', null);

  if (flashcardsError) throw flashcardsError;

  const set = new Set<string>();
  for (const card of flashcards ?? []) {
    if (card.id) set.add(card.id);
    if ((card as any).parent_card_id) set.add((card as any).parent_card_id);
  }
  return Array.from(set);
}

async function fetchFavoritesByScope(
  userId: string,
  resourceType: FavoriteResourceType,
  scope?: FavoriteScope
): Promise<string[]> {
  if (resourceType !== 'flashcard' || !hasScope(scope)) {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('resource_id')
      .eq('user_id', userId)
      .eq('resource_type', resourceType);

    if (error) throw error;
    return data?.map((favorite) => favorite.resource_id) ?? [];
  }

  const scopedFlashcardIds = await resolveScopedFlashcardIds(scope!);
  if (scopedFlashcardIds.length === 0) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('resource_id')
    .eq('user_id', userId)
    .eq('resource_type', resourceType)
    .in('resource_id', scopedFlashcardIds);

  if (error) throw error;
  return data?.map((favorite) => favorite.resource_id) ?? [];
}

export function useFavorites(
  userId: string | undefined,
  resourceType: FavoriteResourceType,
  scope?: FavoriteScope
) {
  return useQuery({
    queryKey: [
      'favorites',
      userId,
      resourceType,
      scope?.listId ?? null,
      scope?.collectionId ?? null,
      scope?.folderId ?? null,
      scope?.institutionId ?? null,
    ],
    queryFn: async () => {
      if (!userId) return [];
      return fetchFavoritesByScope(userId, resourceType, scope);
    },
    enabled: !!userId,
    // PERF: keep last result while refetching to avoid loading flashes on navigation
    staleTime: 60_000,
    placeholderData: keepPreviousData,
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
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('resource_type', resourceType)
          .eq('resource_id', resourceId);
        
        if (error) throw error;

        // Auto-remove from red list when unfavoriting a flashcard
        if (resourceType === 'flashcard') {
          await removeFromRedListIfNeeded(user.id, resourceId);
        }
      } else {
        // Safe insert: tolerate duplicate-key races from rapid clicks or
        // concurrent tabs. 23505 = unique_violation in Postgres.
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            resource_type: resourceType,
            resource_id: resourceId,
          });
        if (error && (error as any).code !== '23505') throw error;
      }
      
      return { resourceId, resourceType, isFavorite: !isFavorite, userId: user.id };
    },

    onMutate: async ({ resourceId, resourceType, isFavorite }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await queryClient.cancelQueries({ queryKey: ['favorites', user.id, resourceType] });
      await queryClient.cancelQueries({ queryKey: ['favorites-count', user.id, resourceType] });

      const previousFavoritesEntries = queryClient.getQueriesData<string[]>({
        queryKey: ['favorites', user.id, resourceType],
      });

      const previousCountEntries = queryClient.getQueriesData<number>({
        queryKey: ['favorites-count', user.id, resourceType],
      });

      queryClient.setQueriesData<string[]>({
        queryKey: ['favorites', user.id, resourceType],
      }, (old = []) => {
        if (isFavorite) {
          return old.filter((id) => id !== resourceId);
        }
        return old.includes(resourceId) ? old : [...old, resourceId];
      });

      // Optimistic update for favorites count
      queryClient.setQueriesData<number>({
        queryKey: ['favorites-count', user.id, resourceType],
      }, (old = 0) => {
        return isFavorite ? Math.max(0, old - 1) : old + 1;
      });

      return { previousFavoritesEntries, previousCountEntries, userId: user.id, resourceType };
    },

    onError: (error, _variables, context) => {
      if (context?.previousFavoritesEntries) {
        context.previousFavoritesEntries.forEach(([queryKey, value]) => {
          queryClient.setQueryData(queryKey, value);
        });
      }
      if (context?.previousCountEntries) {
        context.previousCountEntries.forEach(([queryKey, value]) => {
          queryClient.setQueryData(queryKey, value);
        });
      }
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao sincronizar favorito');
    },
    
    onSuccess: (data) => {
      toast.success(data.isFavorite ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos');
    },

    onSettled: (_data, _error, variables, context) => {
      if (context?.userId && context?.resourceType) {
        queryClient.invalidateQueries({ queryKey: ['favorites', context.userId, context.resourceType] });
        queryClient.invalidateQueries({ queryKey: ['favorites-count', context.userId, context.resourceType] });
        // If unfavoriting a flashcard, also invalidate red-list cache
        if (variables?.isFavorite && variables?.resourceType === 'flashcard') {
          queryClient.invalidateQueries({ queryKey: ['red-list', context.userId] });
        }
      }
    },
  });
}

export function useFavoritesCount(
  userId: string | undefined,
  resourceType: FavoriteResourceType,
  scope?: FavoriteScope
) {
  return useQuery({
    queryKey: [
      'favorites-count',
      userId,
      resourceType,
      scope?.listId ?? null,
      scope?.collectionId ?? null,
      scope?.folderId ?? null,
      scope?.institutionId ?? null,
    ],
    queryFn: async () => {
      if (!userId) return 0;

      if (resourceType === 'flashcard' && hasScope(scope)) {
        const scopedFavorites = await fetchFavoritesByScope(userId, resourceType, scope);
        return scopedFavorites.length;
      }
      
      const { count, error } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('resource_type', resourceType);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    // PERF: avoid loading flashes when re-entering GamesHub from a list
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

// Helper hook for flashcard favorites (backwards compatibility)
export function useFlashcardFavorites(userId: string | undefined) {
  return useFavorites(userId, 'flashcard');
}
