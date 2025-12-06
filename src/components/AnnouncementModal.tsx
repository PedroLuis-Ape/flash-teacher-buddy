import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  turma_nome?: string;
}

const LAST_SEEN_KEY = 'last-announcement-seen';

export function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkForNewAnnouncements();
  }, []);

  const checkForNewAnnouncements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get student's turmas (using turma_membros table for the new turmas system)
      const { data: memberships } = await supabase
        .from('turma_membros')
        .select('turma_id')
        .eq('user_id', user.id)
        .eq('ativo', true);

      if (!memberships || memberships.length === 0) return;

      const turmaIds = memberships.map(m => m.turma_id);

      // Map turma_ids to class_ids for announcements (turmas.id is used as class_id in announcements)
      // First, get the turmas to find their corresponding class_id if any
      const { data: turmas } = await supabase
        .from('turmas')
        .select('id')
        .in('id', turmaIds);

      if (!turmas || turmas.length === 0) return;
      
      // Get last seen announcement ID from localStorage
      const lastSeenId = localStorage.getItem(LAST_SEEN_KEY);

      // Query for announcements using turma IDs as class_id
      let query = supabase
        .from('announcements')
        .select('id, title, body, created_at, class_id')
        .in('class_id', turmaIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: announcements } = await query;

      if (announcements && announcements.length > 0) {
        const ann = announcements[0];

        // Check if we've already seen this announcement
        if (lastSeenId && ann.id <= lastSeenId) return;

        // Get turma name
        const { data: turma } = await supabase
          .from('turmas')
          .select('nome')
          .eq('id', ann.class_id)
          .single();

        setAnnouncement({
          ...ann,
          turma_nome: turma?.nome || 'Turma',
        });
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error checking announcements:', error);
    }
  };

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem(LAST_SEEN_KEY, announcement.id);
    }
    setIsOpen(false);
    setAnnouncement(null);
  };

  if (!announcement) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogDescription className="text-sm text-muted-foreground">
                Aviso de {announcement.turma_nome}
              </DialogDescription>
              <DialogTitle className="text-xl font-bold">
                {announcement.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="py-6">
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {announcement.body}
          </p>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleDismiss} 
            className="w-full min-h-[48px] text-base font-semibold"
            size="lg"
          >
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
