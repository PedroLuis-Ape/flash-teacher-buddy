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
      if (!session) throw new Error('Você precisa estar logado para ver notificações.');

      const body = { limit: 20, ...(cursor && { cursor }) } as const;

      // 1ª tentativa - supabase.functions.invoke injeta o JWT automaticamente a partir da sessão atual
      let { data, error }: any = await supabase.functions.invoke('notifications-list', {
        body,
      });

      // Se 401, tenta refresh e re-invoca uma vez
      const status = (error as any)?.context?.status;
      if (error && status === 401) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData.session) {
          const retry = await supabase.functions.invoke('notifications-list', { body });
          data = retry.data;
          error = retry.error as any;
        }
      }

      if (error) throw new Error((error as any)?.message || 'Erro ao buscar notificações');

      const result = data as any;
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
      const status = (error?.context as any)?.status;
      if (status === 401 || /não autorizado|unauthorized|401/i.test(error?.message)) {
        toast.error('Sessão expirada. Faça login novamente.');
        try {
          sessionStorage.setItem('logoutInProgress', String(Date.now()));
          await supabase.auth.signOut();
        } finally {
          window.location.replace('/auth');
        }
        return;
      }
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
        });

        if (error) throw error as any;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao marcar como lidas');

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
        const status = (error?.context as any)?.status;
        if (status === 401 || /não autorizado|unauthorized|401/i.test(error?.message)) {
          toast.error('Sessão expirada. Faça login novamente.');
          try {
            sessionStorage.setItem('logoutInProgress', String(Date.now()));
            await supabase.auth.signOut();
          } finally {
            window.location.replace('/auth');
          }
          return;
        }
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
