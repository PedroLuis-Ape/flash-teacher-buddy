import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Thread {
  thread_id: string;
  other_user: {
    id: string;
    name: string;
    user_type: string;
  };
  last_message: {
    body: string;
    sent_at: string;
    is_mine: boolean;
  } | null;
  unread_count: number;
  created_at: string;
}

export function useThreads(classId: string | null) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = async () => {
    if (!classId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Você precisa estar logado.');
        return;
      }

      const response = await supabase.functions.invoke('threads-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { class_id: classId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        setThreads(response.data.threads || []);
      } else {
        throw new Error(response.data?.message || 'Erro ao buscar conversas');
      }
    } catch (err: any) {
      console.error('Error fetching threads:', err);
      setError(err.message || 'Erro ao buscar conversas');
      toast.error(err.message || 'Erro ao buscar conversas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [classId]);

  const findOrCreateThread = async (otherUserId: string) => {
    if (!classId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado.');
        return null;
      }

      const response = await supabase.functions.invoke('threads-find-or-create', {
        body: { class_id: classId, other_user_id: otherUserId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        return response.data.thread_id;
      } else {
        throw new Error(response.data?.message || 'Erro ao criar conversa');
      }
    } catch (err: any) {
      console.error('Error finding/creating thread:', err);
      toast.error(err.message || 'Erro ao criar conversa');
      return null;
    }
  };

  return {
    threads,
    loading,
    error,
    findOrCreateThread,
    refetch: fetchThreads,
  };
}
