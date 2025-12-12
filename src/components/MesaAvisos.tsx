import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Megaphone, BookOpen, Users, Clock, ChevronDown, ChevronUp, ExternalLink, Check, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAvisosByTurma, Aviso } from '@/hooks/useAvisos';
import { cn } from '@/lib/utils';

interface MesaAvisosProps {
  turmaId: string;
  isOwner: boolean;
}

export function MesaAvisos({ turmaId, isOwner }: MesaAvisosProps) {
  const navigate = useNavigate();
  const { data: avisos = [], isLoading, refetch } = useAvisosByTurma(turmaId, isOwner);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMarkAsRead = async (aviso: Aviso) => {
    if (aviso.lida) return;
    
    try {
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', aviso.id);
      refetch();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleGoToAssignment = (aviso: Aviso) => {
    if (aviso.metadata?.turma_id && aviso.metadata?.assignment_id) {
      navigate(`/turmas/${aviso.metadata.turma_id}/atribuicoes/${aviso.metadata.assignment_id}`);
    }
  };

  const openDetail = async (aviso: Aviso) => {
    setSelectedAviso(aviso);
    if (!aviso.lida && !isOwner) {
      await handleMarkAsRead(aviso);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando avisos...</div>
      </div>
    );
  }

  if (avisos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Nenhum aviso</h3>
        <p className="text-muted-foreground max-w-sm">
          {isOwner 
            ? 'Você ainda não enviou nenhum aviso para esta turma. Use o botão "Aviso" acima para criar um.'
            : 'Ainda não há avisos nesta turma.'}
        </p>
      </div>
    );
  }

  const unreadCount = avisos.filter(a => !a.lida).length;

  return (
    <div className="space-y-4">
      {/* Header com contador */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Mesa de Avisos</h3>
          <Badge variant="secondary">{avisos.length}</Badge>
          {!isOwner && unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} não lido(s)</Badge>
          )}
        </div>
      </div>

      {/* Lista de avisos */}
      <ScrollArea className="h-[calc(100vh-350px)] min-h-[300px]">
        <div className="space-y-3 pr-4">
          {avisos.map((aviso) => {
            const isAssignment = aviso.tipo === 'aviso_atribuicao';
            const isExpanded = expandedCards.has(aviso.id);
            const fullBody = aviso.metadata?.full_body || aviso.mensagem;

            return (
              <Card 
                key={aviso.id}
                className={cn(
                  'transition-all cursor-pointer hover:shadow-md',
                  !aviso.lida && !isOwner && 'border-l-4 border-l-primary bg-primary/5'
                )}
                onClick={() => openDetail(aviso)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        isAssignment 
                          ? 'bg-amber-100 dark:bg-amber-900/30' 
                          : 'bg-primary/10'
                      )}>
                        {isAssignment ? (
                          <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Megaphone className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold line-clamp-1">
                          {aviso.titulo}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge 
                            variant={isAssignment ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs',
                              isAssignment && 'bg-amber-500 hover:bg-amber-600'
                            )}
                          >
                            {isAssignment ? 'Atividade' : 'Geral'}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(aviso.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!aviso.lida && !isOwner && (
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      )}
                      {isOwner && aviso.recipient_count && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {aviso.recipient_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {fullBody}
                  </p>

                  {/* Assignment info */}
                  {isAssignment && aviso.metadata?.assignment_title && (
                    <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-800 dark:text-amber-200 font-medium">
                        {aviso.metadata.assignment_title}
                      </span>
                    </div>
                  )}

                  {/* Professor: recipients list (collapsed) */}
                  {isOwner && aviso.recipients && aviso.recipients.length > 0 && (
                    <Collapsible 
                      open={isExpanded} 
                      onOpenChange={() => toggleExpanded(aviso.id)}
                      className="mt-3"
                    >
                      <CollapsibleTrigger 
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Users className="h-3 w-3" />
                        <span>Ver destinatários ({aviso.recipients.length})</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {aviso.recipients.slice(0, 10).map((r) => (
                            <Badge key={r.id} variant="outline" className="text-xs">
                              {r.first_name}
                            </Badge>
                          ))}
                          {aviso.recipients.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{aviso.recipients.length - 10} mais
                            </Badge>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Modal de detalhe do aviso */}
      <Dialog open={!!selectedAviso} onOpenChange={(open) => !open && setSelectedAviso(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedAviso && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'h-12 w-12 rounded-full flex items-center justify-center shrink-0',
                    selectedAviso.tipo === 'aviso_atribuicao' 
                      ? 'bg-amber-100 dark:bg-amber-900/30' 
                      : 'bg-primary/10'
                  )}>
                    {selectedAviso.tipo === 'aviso_atribuicao' ? (
                      <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Megaphone className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <Badge 
                      variant={selectedAviso.tipo === 'aviso_atribuicao' ? 'default' : 'secondary'}
                      className={cn(
                        'mb-1',
                        selectedAviso.tipo === 'aviso_atribuicao' && 'bg-amber-500'
                      )}
                    >
                      {selectedAviso.tipo === 'aviso_atribuicao' ? 'Aviso de Atividade' : 'Aviso Geral'}
                    </Badge>
                    <DialogDescription className="text-xs text-muted-foreground">
                      {format(new Date(selectedAviso.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </DialogDescription>
                  </div>
                </div>
                <DialogTitle className="text-xl">
                  {selectedAviso.titulo}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {selectedAviso.metadata?.full_body || selectedAviso.mensagem}
                </div>

                {selectedAviso.tipo === 'aviso_atribuicao' && selectedAviso.metadata?.assignment_title && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                        Atividade Vinculada
                      </p>
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        {selectedAviso.metadata.assignment_title}
                      </p>
                    </div>
                  </div>
                )}

                {/* Professor: list of recipients */}
                {isOwner && selectedAviso.recipients && selectedAviso.recipients.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Enviado para {selectedAviso.recipient_count} aluno(s)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedAviso.recipients.map((r) => (
                        <Badge key={r.id} variant="outline" className="text-xs">
                          {r.first_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedAviso(null)}
                  className="w-full sm:w-auto"
                >
                  Fechar
                </Button>
                
                {selectedAviso.tipo === 'aviso_atribuicao' && selectedAviso.metadata?.assignment_id && (
                  <Button 
                    onClick={() => {
                      handleGoToAssignment(selectedAviso);
                      setSelectedAviso(null);
                    }}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Ir para atividade
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
