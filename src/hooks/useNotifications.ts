import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { useAuthUser } from '@/hooks/useAuthUser';
import { usePerformance } from '@/contexts/PerformanceContext';

const ALERT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export interface Notification {
  id: string;
  recipient_id: string;
  tipo: 'atribuicao_concluida' | 'mensagem_recebida' | 'aluno_inscrito' | 'aviso' | 'aviso_atribuicao' | 'dm';
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
  const { userId } = useAuthUser();
  const { settings } = usePerformance();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundPlayedRef = useRef<number>(0);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const playAlertSound = useCallback(() => {
    if (!settings.soundEffects) return;

    const now = Date.now();
    if (now - lastSoundPlayedRef.current < 2000) return;
    lastSoundPlayedRef.current = now;

    if (!audioRef.current) {
      const audio = new Audio(ALERT_SOUND_URL);
      audio.preload = 'none';
      audio.volume = 0.5;
      audioRef.current = audio;
    }

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Mobile browsers can reject autoplay until the next user gesture.
    });
  }, [settings.soundEffects]);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      sonnerToast.error('Seu navegador não suporta notificações nativas.');
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        sonnerToast.success('Notificações ativadas!');
      } else if (permission === 'denied') {
        sonnerToast.error('Permissão de notificações negada.');
      }

      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Notification[];
    },
  });

  const unreadCount = notifications.reduce((count, notification) => (
    notification.lida ? count : count + 1
  ), 0);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;

      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('recipient_id', userId)
        .eq('lida', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      toast({
        title: 'Todas as notificações foram marcadas como lidas',
      });
    },
  });

  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.lida) {
      markAsReadMutation.mutate(notification.id);
    }

    const metadata = notification.metadata || {};

    if (notification.tipo === 'atribuicao_concluida' && metadata.turma_id) {
      navigate(`/turmas/${metadata.turma_id}`);
    } else if (notification.tipo === 'mensagem_recebida' && metadata.turma_id) {
      navigate(`/turmas/${metadata.turma_id}?tab=mensagens&sender=${metadata.sender_id}`);
    } else if (notification.tipo === 'aluno_inscrito') {
      navigate('/professor/alunos');
    } else if (notification.tipo === 'aviso' && metadata.turma_id) {
      navigate(`/turmas/${metadata.turma_id}`);
    } else if (notification.tipo === 'aviso_atribuicao') {
      const fonteId = metadata.fonte_id;
      const fonteTipo = metadata.fonte_tipo;

      if (fonteId && fonteTipo === 'lista') {
        navigate(`/list/${fonteId}/games`);
      } else if (fonteId && fonteTipo === 'pasta') {
        navigate(`/folder/${fonteId}`);
      } else if (metadata.turma_id) {
        navigate(`/turmas/${metadata.turma_id}`);
      }
    } else if (notification.tipo === 'dm' && metadata.turma_id) {
      navigate(`/turmas/${metadata.turma_id}?tab=mensagens&sender=${metadata.sender_id}`);
    }
  }, [markAsReadMutation, navigate]);

  const showBrowserNotification = useCallback((notification: Notification) => {
    if (notificationPermission !== 'granted') return;

    try {
      const browserNotif = new window.Notification(notification.titulo, {
        body: notification.mensagem,
        icon: '/favicon.png',
        tag: notification.id,
        data: {
          assignment_id: notification.metadata?.assignment_id,
          turma_id: notification.metadata?.turma_id,
        },
      });

      browserNotif.onclick = () => {
        window.focus();
        handleNotificationClick(notification);
        browserNotif.close();
      };
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }, [handleNotificationClick, notificationPermission]);

  const handlersRef = useRef({ playAlertSound, showBrowserNotification, handleNotificationClick });
  useEffect(() => {
    handlersRef.current = { playAlertSound, showBrowserNotification, handleNotificationClick };
  }, [playAlertSound, showBrowserNotification, handleNotificationClick]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          handlersRef.current.playAlertSound();
          handlersRef.current.showBrowserNotification(newNotification);

          const actionable = newNotification.tipo === 'aviso_atribuicao' || newNotification.tipo === 'dm';
          sonnerToast(newNotification.titulo, {
            description: newNotification.mensagem,
            duration: 8000,
            action: actionable ? {
              label: newNotification.tipo === 'dm' ? 'Abrir Conversa' : 'Abrir Atribuição',
              onClick: () => handlersRef.current.handleNotificationClick(newNotification),
            } : undefined,
          });

          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    handleNotificationClick,
    notificationPermission,
    requestNotificationPermission,
  };
}
