import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, BookOpen, ExternalLink, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AnnouncementData {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'aviso' | 'aviso_atribuicao' | 'dm';
  metadata?: {
    full_body?: string;
    turma_nome?: string;
    turma_id?: string;
    assignment_id?: string;
    assignment_title?: string;
    fonte_id?: string;
    fonte_tipo?: 'lista' | 'pasta' | 'cardset';
    // DM specific
    dm_id?: string;
    sender_id?: string;
    sender_name?: string;
    is_teacher_sending?: boolean;
  };
}

const LAST_SEEN_KEY = 'last-announcement-seen';

export function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Check for unread announcements on mount
  const checkForNewAnnouncements = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const lastSeenId = localStorage.getItem(LAST_SEEN_KEY);

      // Query for unread announcements (aviso or aviso_atribuicao) from notificacoes table
      const { data: notifications, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('recipient_id', user.id)
        .in('tipo', ['aviso', 'aviso_atribuicao'])
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching announcements:', error);
        return;
      }

      if (notifications && notifications.length > 0) {
        const notif = notifications[0];

        // Check if we've already seen this notification in this session
        if (lastSeenId && notif.id <= lastSeenId) return;

        const metadata = notif.metadata as Record<string, any> | null;

        setAnnouncement({
          id: notif.id,
          titulo: notif.titulo,
          mensagem: notif.mensagem,
          tipo: notif.tipo as 'aviso' | 'aviso_atribuicao',
          metadata: metadata || undefined,
        });
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error checking announcements:', error);
    }
  }, []);

  useEffect(() => {
    checkForNewAnnouncements();
  }, [checkForNewAnnouncements]);

  // Set up realtime subscription for new announcements
  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('[AnnouncementModal] Setting up realtime for user:', user.id);

      const channel = supabase
        .channel('announcement-popup-monitor')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificacoes',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const notif = payload.new as any;
            console.log('[AnnouncementModal] Received notification:', notif.tipo);
            
            // Only show modal for announcement types and DM
            if (notif.tipo === 'aviso' || notif.tipo === 'aviso_atribuicao' || notif.tipo === 'dm') {
              const metadata = notif.metadata as Record<string, any> | null;
              
              setAnnouncement({
                id: notif.id,
                titulo: notif.titulo,
                mensagem: notif.mensagem,
                tipo: notif.tipo,
                metadata: metadata || undefined,
              });
              setIsOpen(true);
            }
          }
        )
        .subscribe((status) => {
          console.log('[AnnouncementModal] Subscription status:', status);
        });

      return () => {
        console.log('[AnnouncementModal] Cleaning up realtime subscription');
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, []);

  const handleDismiss = async () => {
    if (announcement) {
      // Save last seen ID
      localStorage.setItem(LAST_SEEN_KEY, announcement.id);
      
      // Mark notification as read
      try {
        await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', announcement.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
    setIsOpen(false);
    setAnnouncement(null);
  };

  const handleGoToAssignment = async () => {
    await handleDismiss();
    
    // Navigate directly to content
    const fonteId = announcement?.metadata?.fonte_id;
    const fonteTipo = announcement?.metadata?.fonte_tipo;
    
    if (fonteId && fonteTipo === 'lista') {
      navigate(`/list/${fonteId}/games`);
    } else if (fonteId && fonteTipo === 'pasta') {
      navigate(`/folder/${fonteId}`);
    } else if (announcement?.metadata?.turma_id) {
      // Fallback to turma if fonte info not available
      navigate(`/turmas/${announcement.metadata.turma_id}`);
    }
  };

  const handleOpenDM = async () => {
    await handleDismiss();
    
    if (announcement?.metadata?.turma_id && announcement?.metadata?.dm_id) {
      navigate(`/turmas/${announcement.metadata.turma_id}?tab=mensagens&dm=${announcement.metadata.dm_id}`);
    }
  };

  if (!announcement) return null;

  const isAssignment = announcement.tipo === 'aviso_atribuicao';
  const isDM = announcement.tipo === 'dm';
  const fullBody = announcement.metadata?.full_body || announcement.mensagem;
  const assignmentTitle = announcement.metadata?.assignment_title;
  const turmaNome = announcement.metadata?.turma_nome || 'Turma';
  const senderName = announcement.metadata?.sender_name;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // MODAL BLOQUEANTE: não permite fechar pelo overlay ou ESC
        // Só fecha via botões explícitos
        if (!open) return;
      }}
    >
      <DialogContent 
        className="sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-4 pt-2">
          <div className="flex items-center justify-center">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
              isDM
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : isAssignment 
                ? 'bg-amber-100 dark:bg-amber-900/30' 
                : 'bg-primary/10'
            }`}>
              {isDM ? (
                <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              ) : isAssignment ? (
                <BookOpen className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              ) : (
                <Megaphone className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          
          <div className="text-center space-y-2">
          <DialogDescription className="text-sm text-muted-foreground">
              {isDM 
                ? `Mensagem de Professor @${senderName || 'Professor'} - ${turmaNome}`
                : isAssignment 
                ? `Nova atividade atribuída - ${turmaNome}`
                : `Comunicado de ${turmaNome}`}
            </DialogDescription>
            <DialogTitle className="text-2xl font-bold">
              {announcement.titulo}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg border text-base leading-relaxed max-h-[250px] overflow-y-auto whitespace-pre-wrap">
            {fullBody}
          </div>
          
          {isAssignment && assignmentTitle && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                  Atividade Vinculada
                </p>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  {assignmentTitle}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-center pt-2">
          {isDM ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleDismiss}
                className="w-full sm:w-auto min-w-[120px]"
              >
                Ver depois
              </Button>
              <Button 
                onClick={handleOpenDM}
                className="w-full sm:w-auto min-w-[180px] font-bold bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                Abrir Conversa
                <MessageSquare className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : isAssignment ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleDismiss}
                className="w-full sm:w-auto min-w-[120px]"
              >
                Ver depois
              </Button>
              <Button 
                onClick={handleGoToAssignment}
                className="w-full sm:w-auto min-w-[180px] font-bold bg-amber-600 hover:bg-amber-700 text-white"
                size="lg"
              >
                Ir para atividade
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button 
              onClick={handleDismiss} 
              className="w-full sm:w-[200px] min-h-[48px] text-base font-semibold"
              size="lg"
            >
              Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
