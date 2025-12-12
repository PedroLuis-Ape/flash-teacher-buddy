import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';

// Alert sound URL
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundPlayedRef = useRef<number>(0);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND_URL);
    audioRef.current.volume = 0.5;
    
    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  // Play alert sound with debounce
  const playAlertSound = useCallback(() => {
    const now = Date.now();
    // Debounce: don't play if last sound was less than 2 seconds ago
    if (now - lastSoundPlayedRef.current < 2000) return;
    
    lastSoundPlayedRef.current = now;
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, []);

  // Request notification permission
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

  // Show browser notification
  const showBrowserNotification = useCallback((notification: Notification) => {
    if (notificationPermission !== 'granted') return;

    try {
      const browserNotif = new window.Notification(notification.titulo, {
        body: notification.mensagem,
        icon: '/favicon.png',
        tag: notification.id, // Prevent duplicate notifications
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
  }, [notificationPermission]);

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
  const handleNotificationClick = useCallback((notification: Notification) => {
    // Mark as read
    if (!notification.lida) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate based on notification type
    const metadata = notification.metadata || {};
    
    if (notification.tipo === 'atribuicao_concluida' && metadata.turma_id) {
      // Navigate to turma page (assignment detail removed)
      navigate(`/turmas/${metadata.turma_id}`);
    } else if (notification.tipo === 'mensagem_recebida' && metadata.turma_id) {
      navigate(`/turmas/${metadata.turma_id}`);
    } else if (notification.tipo === 'aluno_inscrito') {
      navigate('/professor/alunos');
    } else if (notification.tipo === 'aviso' && metadata.turma_id) {
      // General announcement - navigate to turma
      navigate(`/turmas/${metadata.turma_id}`);
    } else if (notification.tipo === 'aviso_atribuicao') {
      // Direct assignment - navigate directly to content
      const fonteId = metadata.fonte_id;
      const fonteTipo = metadata.fonte_tipo;
      
      if (fonteId && fonteTipo === 'lista') {
        navigate(`/list/${fonteId}/games`);
      } else if (fonteId && fonteTipo === 'pasta') {
        navigate(`/folder/${fonteId}`);
      } else if (metadata.turma_id) {
        // Fallback to turma if fonte info not available
        navigate(`/turmas/${metadata.turma_id}`);
      }
    } else if (notification.tipo === 'dm' && metadata.turma_id) {
      // Direct message - navigate to turma with DM tab open and sender param for auto-open
      navigate(`/turmas/${metadata.turma_id}?tab=mensagens&sender=${metadata.sender_id}`);
    }
  }, [navigate, markAsReadMutation]);

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
            console.log('New notification received:', newNotification);
            
            // Only process after initial load
            if (isInitialized) {
              // Play alert sound
              playAlertSound();
              
              // Show browser notification
              showBrowserNotification(newNotification);
              
              // Show toast notification
              const isAssignmentNotification = newNotification.tipo === 'aviso_atribuicao';
              const isDMNotification = newNotification.tipo === 'dm';
              
              sonnerToast(newNotification.titulo, {
                description: newNotification.mensagem,
                duration: 8000,
                action: (isAssignmentNotification || isDMNotification) ? {
                  label: isDMNotification ? 'Abrir Conversa' : 'Abrir Atribuição',
                  onClick: () => handleNotificationClick(newNotification),
                } : undefined,
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
  }, [queryClient, isInitialized, playAlertSound, showBrowserNotification, handleNotificationClick]);

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
