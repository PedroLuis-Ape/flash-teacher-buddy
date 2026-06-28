import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows';
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

async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id) return session.user.id;

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * CLARA MASTER P0 — flashcard+scope favorites are read SERVER-SIDE via the
 * `get_scoped_flashcard_favorites` RPC. It returns ONLY canonical group ids
 * (parent_card_id ?? id), regardless of whether the legacy favorite row was
 * written against a layer or the principal. No `.in(longArray)` from the
 * client, no missing layered favorites after a cold restart.
 */
async function fetchScopedFlashcardGroupIds(scope: FavoriteScope): Promise<string[]> {
  const data = await fetchAllSupabaseRows<{ group_id: string }>((from, to) =>
    (supabase as any)
      .rpc('get_scoped_flashcard_favorites', {
        p_list_id: scope.listId ?? null,
        p_collection_id: scope.collectionId ?? null,
        p_folder_id: scope.folderId ?? null,
        p_institution_id: scope.institutionId ?? null,
      })
      .range(from, to),
  );
  const seen = new Set<string>();
  for (const row of data) {
    if (row?.group_id) seen.add(row.group_id);
  }
  return Array.from(seen);
}

async function fetchFavoritesByScope(
  userId: string,
  resourceType: FavoriteResourceType,
  scope?: FavoriteScope
): Promise<string[]> {
  if (resourceType !== 'flashcard' || !hasScope(scope)) {
    const data = await fetchAllSupabaseRows<{ resource_id: string }>((from, to) =>
      (supabase as any)
        .from('user_favorites')
        .select('resource_id')
        .eq('user_id', userId)
        .eq('resource_type', resourceType)
        .order('resource_id', { ascending: true })
        .range(from, to),
    );

    return data.map((favorite) => favorite.resource_id);
  }

  return fetchScopedFlashcardGroupIds(scope!);
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
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ['favorite-toggle'],
    mutationFn: async ({ 
      resourceId, 
      resourceType, 
      isFavorite 
    }: { 
      resourceId: string; 
      resourceType: FavoriteResourceType;
      isFavorite: boolean;
    }) => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Não autenticado');
      
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('resource_type', resourceType)
          .eq('resource_id', resourceId);
        
        if (error) throw error;

        if (resourceType === 'flashcard') {
          await removeFromRedListIfNeeded(userId, resourceId);
        }
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: userId,
            resource_type: resourceType,
            resource_id: resourceId,
          });
        if (error && (error as any).code !== '23505') throw error;
      }
      
      return { resourceId, resourceType, isFavorite: !isFavorite, userId };
    },

    onMutate: async ({ resourceId, resourceType, isFavorite }) => {
      const userId = await getCurrentUserId();
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['favorites', userId, resourceType] });
      await queryClient.cancelQueries({ queryKey: ['favorites-count', userId, resourceType] });

      const previousFavoritesEntries = queryClient.getQueriesData<string[]>({
        queryKey: ['favorites', userId, resourceType],
      });

      const previousCountEntries = queryClient.getQueriesData<number>({
        queryKey: ['favorites-count', userId, resourceType],
      });

      queryClient.setQueriesData<string[]>({
        queryKey: ['favorites', userId, resourceType],
      }, (old = []) => {
        if (isFavorite) {
          return old.filter((id) => id !== resourceId);
        }
        return old.includes(resourceId) ? old : [...old, resourceId];
      });

      queryClient.setQueriesData<number>({
        queryKey: ['favorites-count', userId, resourceType],
      }, (old = 0) => {
        return isFavorite ? Math.max(0, old - 1) : old + 1;
      });

      return { previousFavoritesEntries, previousCountEntries, userId, resourceType };
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
        const scopedGroups = await fetchScopedFlashcardGroupIds(scope!);
        return scopedGroups.length;
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
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useFlashcardFavorites(userId: string | undefined) {
  return useFavorites(userId, 'flashcard');
}
