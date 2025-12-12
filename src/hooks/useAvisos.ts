import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Aviso {
  id: string;
  tipo: 'aviso' | 'aviso_atribuicao';
  titulo: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
  metadata: {
    announcement_id?: string;
    full_body?: string;
    turma_nome?: string;
    turma_id?: string;
    assignment_id?: string;
    assignment_title?: string;
  } | null;
  // Professor view: count of recipients
  recipient_count?: number;
  recipients?: Array<{
    id: string;
    first_name: string;
    ape_id: string;
  }>;
}

/**
 * Hook to fetch avisos/announcements for a turma
 * - For students: shows only their notifications (recipient_id = user.id)
 * - For professors: shows all notifications grouped by announcement_id
 */
export function useAvisosByTurma(turmaId: string | null, isOwner: boolean) {
  return useQuery({
    queryKey: ['avisos-turma', turmaId, isOwner],
    queryFn: async () => {
      if (!turmaId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      if (isOwner) {
        // Professor: Get all notifications for this turma, grouped by announcement_id
        const { data: notifications, error } = await supabase
          .from('notificacoes')
          .select('*')
          .in('tipo', ['aviso', 'aviso_atribuicao'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching avisos:', error);
          return [];
        }

        // Filter by turma_id from metadata and group by announcement_id
        const turmaNotifs = (notifications || []).filter((n: any) => {
          const meta = n.metadata as Record<string, any> | null;
          return meta?.turma_id === turmaId;
        });

        // Group by announcement_id
        const grouped = new Map<string, any>();
        
        for (const notif of turmaNotifs) {
          const meta = notif.metadata as Record<string, any> | null;
          const announcementId = meta?.announcement_id || notif.id;
          
          if (!grouped.has(announcementId)) {
            grouped.set(announcementId, {
              id: announcementId,
              tipo: notif.tipo,
              titulo: notif.titulo,
              mensagem: notif.mensagem,
              created_at: notif.created_at,
              lida: true, // Professor doesn't have "read" status
              metadata: meta,
              recipient_count: 0,
              recipient_ids: new Set<string>(),
            });
          }
          
          const group = grouped.get(announcementId);
          group.recipient_count++;
          group.recipient_ids.add(notif.recipient_id);
        }

        // Convert to array and fetch recipient names for each group
        const avisos: Aviso[] = [];
        
        for (const [_, group] of grouped) {
          const recipientIds = Array.from(group.recipient_ids) as string[];
          
          // Fetch recipient profiles
          let recipients: Array<{ id: string; first_name: string; ape_id: string }> = [];
          if (recipientIds.length > 0 && recipientIds.length <= 50) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, first_name, ape_id')
              .in('id', recipientIds);
            
            recipients = (profiles || []).map(p => ({
              id: p.id,
              first_name: p.first_name || 'Aluno',
              ape_id: p.ape_id || '',
            }));
          }

          avisos.push({
            id: group.id,
            tipo: group.tipo,
            titulo: group.titulo,
            mensagem: group.mensagem,
            created_at: group.created_at,
            lida: group.lida,
            metadata: group.metadata,
            recipient_count: group.recipient_count,
            recipients,
          });
        }

        return avisos;
      } else {
        // Student: Get only their notifications
        const { data: notifications, error } = await supabase
          .from('notificacoes')
          .select('*')
          .eq('recipient_id', user.id)
          .in('tipo', ['aviso', 'aviso_atribuicao'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching avisos:', error);
          return [];
        }

        // Filter by turma_id
        const turmaNotifs = (notifications || []).filter((n: any) => {
          const meta = n.metadata as Record<string, any> | null;
          return meta?.turma_id === turmaId;
        });

        return turmaNotifs.map((n: any) => ({
          id: n.id,
          tipo: n.tipo as 'aviso' | 'aviso_atribuicao',
          titulo: n.titulo,
          mensagem: n.mensagem,
          created_at: n.created_at,
          lida: n.lida,
          metadata: n.metadata,
        })) as Aviso[];
      }
    },
    enabled: !!turmaId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
