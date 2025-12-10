import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, BookOpen, Clock, Activity, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface StudentAnalyticsModalProps {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StudentAnalyticsModal({ studentId, isOpen, onClose }: StudentAnalyticsModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['student-analytics', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase.functions.invoke('professor-students-overview', {
        body: { aluno_id: studentId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && isOpen
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Activity className="h-5 w-5 text-primary" />
            Análise de Desempenho: {data?.student?.first_name || 'Aluno'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 pb-6">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 flex flex-col items-center justify-center bg-primary/5">
                  <Trophy className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">{data?.student?.level || 1}</span>
                  <span className="text-xs text-muted-foreground">Nível Atual</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-orange-500/5">
                  <Activity className="h-6 w-6 text-orange-500 mb-2" />
                  <span className="text-2xl font-bold">{data?.student?.current_streak || 0}</span>
                  <span className="text-xs text-muted-foreground">Dias de Ofensiva</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-blue-500/5">
                  <BookOpen className="h-6 w-6 text-blue-500 mb-2" />
                  <span className="text-2xl font-bold">{data?.student?.xp_total || 0}</span>
                  <span className="text-xs text-muted-foreground">XP Total</span>
                </Card>
              </div>

              {/* Activity Chart */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Atividade (XP nos últimos 7 dias)
                </h3>
                <div className="h-[200px] w-full">
                  {data?.dailyActivity?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.dailyActivity}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="activity_date" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          fontSize={12}
                        />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                          formatter={(value) => [`${value} XP`, 'Pontos']}
                        />
                        <Bar dataKey="pts_earned" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      Sem atividade recente registrada.
                    </div>
                  )}
                </div>
              </Card>

              {/* Study Session History */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Últimas Sessões de Estudo
                </h3>
                <div className="space-y-4">
                  {data?.recentSessions?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">O aluno ainda não estudou nenhuma lista.</p>
                  ) : (
                    data?.recentSessions?.map((session: any) => (
                      <div key={session.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{session.list?.title || "Lista desconhecida"}</p>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {session.mode}
                            </Badge>
                            {session.completed && (
                              <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">
                                Completo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
