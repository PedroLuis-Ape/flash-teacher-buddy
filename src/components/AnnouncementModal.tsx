import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, BookOpen, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Announcement {
  id: string;
  titulo: string;
  mensagem: string;
  created_at: string;
  turma_nome?: string;
  turma_id?: string;
  tipo: string;
  metadata?: {
    full_body?: string;
    turma_nome?: string;
    turma_id?: string;
    assignment_id?: string;
    assignment_title?: string;
    announcement_id?: string;
  };
}

const LAST_SEEN_KEY = 'last-announcement-seen';

export function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const checkForNewAnnouncements = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get last seen notification ID from localStorage
      const lastSeenId = localStorage.getItem(LAST_SEEN_KEY);

      // Query for unread announcements (aviso or aviso_atribuicao) from notificacoes table
      const { data: notifications } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('recipient_id', user.id)
        .in('tipo', ['aviso', 'aviso_atribuicao'])
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (notifications && notifications.length > 0) {
        const notif = notifications[0];

        // Check if we've already seen this notification
        if (lastSeenId && notif.id <= lastSeenId) return;

        const metadata = notif.metadata as Record<string, any> | null;

        setAnnouncement({
          id: notif.id,
          titulo: notif.titulo,
          mensagem: notif.mensagem,
          created_at: notif.created_at,
          turma_nome: metadata?.turma_nome || 'Turma',
          turma_id: metadata?.turma_id,
          tipo: notif.tipo,
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

      const channel = supabase
        .channel('announcement-modal-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificacoes',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as any;
            
            // Only show modal for announcement types
            if (newNotification.tipo === 'aviso' || newNotification.tipo === 'aviso_atribuicao') {
              const metadata = newNotification.metadata as Record<string, any> | null;
              
              setAnnouncement({
                id: newNotification.id,
                titulo: newNotification.titulo,
                mensagem: newNotification.mensagem,
                created_at: newNotification.created_at,
                turma_nome: metadata?.turma_nome || 'Turma',
                turma_id: metadata?.turma_id,
                tipo: newNotification.tipo,
                metadata: metadata || undefined,
              });
              setIsOpen(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, []);

  const handleDismiss = async () => {
    if (announcement) {
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

  const handleOpenAssignment = () => {
    if (announcement?.metadata?.turma_id && announcement?.metadata?.assignment_id) {
      handleDismiss();
      navigate(`/turmas/${announcement.metadata.turma_id}/atribuicoes/${announcement.metadata.assignment_id}`);
    }
  };

  if (!announcement) return null;

  const isAssignmentNotification = announcement.tipo === 'aviso_atribuicao';
  const fullBody = announcement.metadata?.full_body || announcement.mensagem;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isAssignmentNotification 
                ? 'bg-amber-500/10' 
                : 'bg-primary/10'
            }`}>
              {isAssignmentNotification ? (
                <BookOpen className="h-6 w-6 text-amber-500" />
              ) : (
                <Megaphone className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <DialogDescription className="text-sm text-muted-foreground">
                {isAssignmentNotification 
                  ? `Aviso sobre atribuição - ${announcement.turma_nome}`
                  : `Aviso de ${announcement.turma_nome}`}
              </DialogDescription>
              <DialogTitle className="text-xl font-bold">
                {announcement.titulo}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="py-6">
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {fullBody}
          </p>
          
          {isAssignmentNotification && announcement.metadata?.assignment_title && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                📚 Atribuição: {announcement.metadata.assignment_title}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {isAssignmentNotification && announcement.metadata?.assignment_id && (
            <Button 
              variant="outline"
              onClick={handleOpenAssignment}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Atribuição
            </Button>
          )}
          <Button 
            onClick={handleDismiss} 
            className="w-full sm:w-auto min-h-[48px] text-base font-semibold"
            size="lg"
          >
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
