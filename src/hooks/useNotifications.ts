import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  user_id: string;
  type: 'dm' | 'announcement' | 'comment';
  ref_type: 'thread' | 'announcement' | 'assignment';
  ref_id: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = useCallback(async (cursor?: string) => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para ver notificações.');
      }

      const response = await supabase.functions.invoke('notifications-list', {
        body: {
          limit: 20,
          ...(cursor && { cursor }),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;

      if (cursor) {
        setNotifications((prev) => [...prev, ...(result.notifications || [])]);
      } else {
        setNotifications(result.notifications || []);
      }

      setNextCursor(result.next_cursor);
      setHasMore(result.has_more);
      setUnreadCount(result.unread_count);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      toast.error(error.message || 'Erro ao buscar notificações');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(
    async (ids?: string[]) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Você precisa estar logado.');

        const { data, error } = await supabase.functions.invoke('notifications-read', {
          body: ids ? { ids } : { mark_all: true },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Erro ao marcar como lidas');

        // Atualizar localmente
        if (ids) {
          setNotifications((prev) =>
            prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - ids.length));
        } else {
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
          setUnreadCount(0);
        }
      } catch (error: any) {
        console.error('Error marking notifications as read:', error);
        toast.error(error.message || 'Erro ao marcar como lidas');
      }
    },
    []
  );

  const loadMore = useCallback(() => {
    if (nextCursor && !loading) {
      fetchNotifications(nextCursor);
    }
  }, [nextCursor, loading, fetchNotifications]);

  // Polling a cada 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Realtime subscription para novas notificações
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchNotifications,
    markAsRead,
    loadMore,
  };
}
