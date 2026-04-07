import { useState, useEffect, useCallback, useRef } from 'react';
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const checkForNewAnnouncements = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const lastSeenId = localStorage.getItem(LAST_SEEN_KEY);

      const { data: notifications, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('recipient_id', session.user.id)
        .in('tipo', ['aviso', 'aviso_atribuicao'])
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !notifications?.length) return;

      const notif = notifications[0];
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
    } catch (error) {
      console.warn('[AnnouncementModal] Error checking announcements:', error);
    }
  }, []);

  useEffect(() => {
    checkForNewAnnouncements();
  }, [checkForNewAnnouncements]);

  // Realtime subscription with PROPER cleanup
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !mounted) return;

      const channel = supabase
        .channel('announcement-popup-monitor')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificacoes',
            filter: `recipient_id=eq.${session.user.id}`,
          },
          (payload) => {
            if (!mounted) return;
            const notif = payload.new as any;
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
        .subscribe();

      channelRef.current = channel;
    };

    setup();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const handleDismiss = async () => {
    // ALWAYS close the modal first — never let dismiss failure trap the user
    setIsOpen(false);

    if (announcement) {
      localStorage.setItem(LAST_SEEN_KEY, announcement.id);
      try {
        await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', announcement.id);
      } catch (error) {
        console.warn('[AnnouncementModal] Error marking as read:', error);
      }
    }
    setAnnouncement(null);
  };

  const handleGoToAssignment = async () => {
    const meta = announcement?.metadata;
    await handleDismiss();

    const fonteId = meta?.fonte_id;
    const fonteTipo = meta?.fonte_tipo;

    if (fonteId && fonteTipo === 'lista') {
      navigate(`/list/${fonteId}/games`);
    } else if (fonteId && fonteTipo === 'pasta') {
      navigate(`/folder/${fonteId}`);
    } else if (meta?.turma_id) {
      navigate(`/turmas/${meta.turma_id}`);
    }
  };

  const handleOpenDM = async () => {
    const meta = announcement?.metadata;
    await handleDismiss();

    if (meta?.turma_id && meta?.dm_id) {
      navigate(`/turmas/${meta.turma_id}?tab=mensagens&dm=${meta.dm_id}`);
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
        // Allow closing — NEVER trap the user
        if (!open) handleDismiss();
      }}
    >
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto">
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
              <Button variant="outline" onClick={handleDismiss} className="w-full sm:w-auto min-w-[120px]">
                Ver depois
              </Button>
              <Button onClick={handleOpenDM} className="w-full sm:w-auto min-w-[180px] font-bold bg-blue-600 hover:bg-blue-700 text-white" size="lg">
                Abrir Conversa
                <MessageSquare className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : isAssignment ? (
            <>
              <Button variant="outline" onClick={handleDismiss} className="w-full sm:w-auto min-w-[120px]">
                Ver depois
              </Button>
              <Button onClick={handleGoToAssignment} className="w-full sm:w-auto min-w-[180px] font-bold bg-amber-600 hover:bg-amber-700 text-white" size="lg">
                Ir para atividade
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={handleDismiss} className="w-full sm:w-[200px] min-h-[48px] text-base font-semibold" size="lg">
              Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
