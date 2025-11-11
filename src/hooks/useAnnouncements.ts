import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Announcement {
  id: string;
  class_id: string;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  profiles?: {
    first_name: string | null;
    avatar_skin_id: string | null;
  };
}

export function useAnnouncements(classId: string) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchAnnouncements = useCallback(async (cursor?: string) => {
    if (!classId) return;

    try {
      setLoading(true);

      const response = await supabase.functions.invoke('announcements-list', {
        body: {
          class_id: classId,
          limit: 20,
          ...(cursor && { cursor }),
        },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;

      if (cursor) {
        setAnnouncements((prev) => [...prev, ...(result.announcements || [])]);
      } else {
        setAnnouncements(result.announcements || []);
      }

      setNextCursor(result.next_cursor);
      setHasMore(result.has_more);
    } catch (error: any) {
      console.error('Error fetching announcements:', error);
      toast.error(error.message || 'Erro ao buscar anúncios');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const createAnnouncement = useCallback(
    async (title: string, body: string, pinned: boolean = false) => {
      try {
        const { data, error } = await supabase.functions.invoke('announcements-create', {
          body: { class_id: classId, title, body, pinned },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Erro ao criar anúncio');

        toast.success('Anúncio criado.');
        await fetchAnnouncements();
        return data.announcement;
      } catch (error: any) {
        console.error('Error creating announcement:', error);
        toast.error(error.message || 'Falha ao enviar. Tentar novamente?');
        throw error;
      }
    },
    [classId, fetchAnnouncements]
  );

  const updateAnnouncement = useCallback(
    async (
      id: string,
      updates: { title?: string; body?: string; pinned?: boolean; archived?: boolean }
    ) => {
      try {
        const { data, error } = await supabase.functions.invoke('announcements-update', {
          body: { id, ...updates },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Erro ao atualizar anúncio');

        toast.success('Anúncio atualizado.');
        await fetchAnnouncements();
        return data.announcement;
      } catch (error: any) {
        console.error('Error updating announcement:', error);
        toast.error(error.message || 'Falha ao atualizar. Tentar novamente?');
        throw error;
      }
    },
    [fetchAnnouncements]
  );

  const loadMore = useCallback(() => {
    if (nextCursor && !loading) {
      fetchAnnouncements(nextCursor);
    }
  }, [nextCursor, loading, fetchAnnouncements]);

  return {
    announcements,
    loading,
    hasMore,
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    loadMore,
  };
}
