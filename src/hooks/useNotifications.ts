import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export interface Notification {
  id: string;
  recipient_id: string;
  tipo: 'atribuicao_concluida' | 'mensagem_recebida' | 'aluno_inscrito';
  titulo: string;
  mensagem: string;
  lida: boolean;
  metadata: any;
  created_at: string;
}

export function useNotifications() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
  });

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.lida).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('recipient_id', user.id)
        .eq('lida', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Todas as notificações foram marcadas como lidas',
      });
    },
  });

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.lida) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate based on notification type
    const metadata = notification.metadata || {};
    
    if (notification.tipo === 'atribuicao_concluida' && metadata.turma_id && metadata.atribuicao_id) {
      navigate(`/turmas/${metadata.turma_id}/atribuicoes/${metadata.atribuicao_id}`);
    } else if (notification.tipo === 'mensagem_recebida' && metadata.turma_id) {
      navigate(`/turmas/${metadata.turma_id}`);
    } else if (notification.tipo === 'aluno_inscrito') {
      navigate('/professor/alunos');
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificacoes',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            
            // Show toast for new notification (only if not the initial load)
            if (isInitialized) {
              toast({
                title: newNotification.titulo,
                description: newNotification.mensagem,
                duration: 5000,
              });
            }

            // Invalidate queries to refetch
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        )
        .subscribe();

      // Mark as initialized after a short delay to avoid showing toasts for existing notifications
      setTimeout(() => setIsInitialized(true), 1000);

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, [queryClient, toast, isInitialized]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    handleNotificationClick,
  };
}
