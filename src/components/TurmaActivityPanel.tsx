import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Clock, BookOpen, Loader2 } from 'lucide-react';

interface TurmaActivityPanelProps {
  turmaId: string;
  membros: { user_id: string; profiles?: { first_name?: string; ape_id?: string } }[];
}

interface StudentActivity {
  student_id: string;
  list_id: string | null;
  mode: string | null;
  progress_pct: number;
  last_activity_at: string;
  list_title?: string;
}

export function TurmaActivityPanel({ turmaId, membros }: TurmaActivityPanelProps) {
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Query para buscar atividades
  const { data: activities, isLoading } = useQuery({
    queryKey: ['turma-activity', turmaId],
    queryFn: async () => {
      // Buscar atividades da turma
      const { data: activityData, error } = await supabase
        .from('turma_student_activity' as any)
        .select('*')
        .eq('turma_id', turmaId)
        .order('last_activity_at', { ascending: false });

      if (error) {
        console.error('[TurmaActivityPanel] Error fetching activity:', error);
        return [];
      }

      // Buscar títulos das listas
      const listIds = (activityData || [])
        .map((a: any) => a.list_id)
        .filter(Boolean);
      
      let listTitles: Record<string, string> = {};
      if (listIds.length > 0) {
        const { data: lists } = await supabase
          .from('lists')
          .select('id, title')
          .in('id', listIds);
        
        listTitles = (lists || []).reduce((acc: Record<string, string>, l: any) => {
          acc[l.id] = l.title;
          return acc;
        }, {});
      }

      return (activityData || []).map((a: any) => ({
        ...a,
        list_title: a.list_id ? listTitles[a.list_id] || 'Lista' : null
      }));
    },
    refetchInterval: 15000, // Fallback: refetch a cada 15s
    refetchOnWindowFocus: true,
  });

  // Setup realtime subscription
  useEffect(() => {
    if (!turmaId) return;

    const channel = supabase
      .channel(`turma-activity-${turmaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turma_student_activity',
          filter: `turma_id=eq.${turmaId}`
        },
        (payload) => {
          console.log('[TurmaActivityPanel] Realtime event:', payload);
          // Invalidar query para refetch
          queryClient.invalidateQueries({ queryKey: ['turma-activity', turmaId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeEnabled(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeEnabled(false);
    };
  }, [turmaId, queryClient]);

  // Criar mapa de atividades por student_id
  const activityMap = new Map(
    (activities || []).map((a: StudentActivity) => [a.student_id, a])
  );

  // Determinar status visual
  const getActivityStatus = (activity: StudentActivity | undefined) => {
    if (!activity?.last_activity_at) {
      return { label: 'Sem atividade', variant: 'secondary' as const, isActive: false };
    }

    const lastActivity = new Date(activity.last_activity_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (diffMinutes <= 2) {
      return { label: 'Estudando agora', variant: 'default' as const, isActive: true };
    } else if (diffMinutes <= 15) {
      return { label: `Há ${Math.round(diffMinutes)} min`, variant: 'outline' as const, isActive: false };
    } else if (diffMinutes <= 60 * 24) {
      return { 
        label: formatDistanceToNow(lastActivity, { addSuffix: true, locale: ptBR }), 
        variant: 'secondary' as const, 
        isActive: false 
      };
    } else if (diffMinutes <= 60 * 24 * 7) {
      return { label: 'Inativo há dias', variant: 'secondary' as const, isActive: false };
    } else {
      return { label: 'Inativo há 7+ dias', variant: 'destructive' as const, isActive: false };
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando atividades...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Atividade dos Alunos
        </h3>
        {realtimeEnabled && (
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
            Ao vivo
          </Badge>
        )}
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3">
          {membros.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum aluno na turma.
            </p>
          ) : (
            membros.map((membro) => {
              const activity = activityMap.get(membro.user_id);
              const status = getActivityStatus(activity);

              return (
                <div
                  key={membro.user_id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    status.isActive ? 'bg-primary/5 border-primary/30' : 'border-border'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {membro.profiles?.first_name || 'Aluno'}
                    </p>
                    {activity?.list_title && status.isActive && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <BookOpen className="h-3 w-3" />
                        <span className="truncate">{activity.list_title}</span>
                        {activity.mode && (
                          <Badge variant="secondary" className="text-[10px] ml-1">
                            {activity.mode}
                          </Badge>
                        )}
                      </p>
                    )}
                    {activity?.last_activity_at && !status.isActive && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        Última atividade: {formatDistanceToNow(new Date(activity.last_activity_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {activity?.progress_pct !== undefined && status.isActive && (
                      <span className="text-xs font-mono text-primary">
                        {activity.progress_pct}%
                      </span>
                    )}
                    <Badge variant={status.variant} className="text-xs whitespace-nowrap">
                      {status.isActive && (
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                      )}
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
