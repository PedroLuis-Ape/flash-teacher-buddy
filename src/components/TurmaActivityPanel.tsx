import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Clock, BookOpen, Loader2, Users, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
      const { data: activityData, error } = await supabase
        .from('turma_student_activity' as any)
        .select('*')
        .eq('turma_id', turmaId)
        .order('last_activity_at', { ascending: false });

      if (error) {
        console.error('[TurmaActivityPanel] Error fetching activity:', error);
        return [];
      }

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
    refetchInterval: 15000,
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
      return { label: 'Sem atividade', variant: 'secondary' as const, isActive: false, category: 'none' as const };
    }

    const lastActivity = new Date(activity.last_activity_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (diffMinutes <= 2) {
      return { label: 'Estudando agora', variant: 'default' as const, isActive: true, category: 'active' as const };
    } else if (diffMinutes <= 15) {
      return { label: `Há ${Math.round(diffMinutes)} min`, variant: 'outline' as const, isActive: false, category: 'recent' as const };
    } else if (diffMinutes <= 60 * 24) {
      return { 
        label: formatDistanceToNow(lastActivity, { addSuffix: true, locale: ptBR }), 
        variant: 'secondary' as const, 
        isActive: false,
        category: 'today' as const
      };
    } else if (diffMinutes <= 60 * 24 * 7) {
      return { label: 'Inativo há dias', variant: 'secondary' as const, isActive: false, category: 'inactive' as const };
    } else {
      return { label: 'Inativo há 7+ dias', variant: 'destructive' as const, isActive: false, category: 'inactive' as const };
    }
  };

  // Calcular resumo geral
  const summary = useMemo(() => {
    const total = membros.length;
    let activeNow = 0;
    let practicedToday = 0;
    let neverPracticed = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    membros.forEach((membro) => {
      const activity = activityMap.get(membro.user_id);
      if (!activity?.last_activity_at) {
        neverPracticed++;
        return;
      }

      const lastActivity = new Date(activity.last_activity_at);
      const diffMinutes = (new Date().getTime() - lastActivity.getTime()) / (1000 * 60);

      if (diffMinutes <= 2) {
        activeNow++;
        practicedToday++;
      } else if (lastActivity >= today) {
        practicedToday++;
      }
    });

    return {
      total,
      activeNow,
      practicedToday,
      neverPracticed,
      inactive: total - practicedToday
    };
  }, [membros, activityMap]);

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
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold">{summary.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div>
            <p className="text-xs text-muted-foreground">Ativos agora</p>
            <p className="font-semibold text-green-600">{summary.activeNow}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Praticaram hoje</p>
            <p className="font-semibold text-primary">{summary.practicedToday}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <div>
            <p className="text-xs text-muted-foreground">Sem prática</p>
            <p className="font-semibold text-destructive">{summary.inactive}</p>
          </div>
        </div>
      </div>

      {/* Lista de alunos com scroll fixo */}
      <ScrollArea className="h-[350px]">
        <div className="space-y-2 pr-4">
          {membros.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum aluno na turma.
            </p>
          ) : (
            <TooltipProvider delayDuration={300}>
              {membros.map((membro) => {
                const activity = activityMap.get(membro.user_id);
                const status = getActivityStatus(activity);

                return (
                  <Tooltip key={membro.user_id}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${
                          status.isActive ? 'bg-primary/5 border-primary/30' : 'border-border'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {membro.profiles?.first_name || 'Aluno'}
                          </p>
                          {membro.profiles?.ape_id && (
                            <p className="text-xs text-muted-foreground">
                              @{membro.profiles.ape_id}
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
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">
                          {membro.profiles?.first_name || 'Aluno'}
                          {membro.profiles?.ape_id && (
                            <span className="text-muted-foreground font-normal ml-1">
                              @{membro.profiles.ape_id}
                            </span>
                          )}
                        </p>
                        
                        {activity ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span>
                                Última atividade: {format(new Date(activity.last_activity_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {activity.list_title && (
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-3 w-3" />
                                <span>Lista: {activity.list_title}</span>
                              </div>
                            )}
                            {activity.mode && (
                              <div className="flex items-center gap-2">
                                <Activity className="h-3 w-3" />
                                <span>Modo: {activity.mode}</span>
                              </div>
                            )}
                            {activity.progress_pct !== undefined && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Progresso: {activity.progress_pct}%</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-muted-foreground flex items-center gap-2">
                            <XCircle className="h-3 w-3" />
                            Nenhuma atividade registrada
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}