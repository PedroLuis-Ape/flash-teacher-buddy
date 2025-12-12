import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Send, User, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DMPanelProps {
  turmaId: string;
  recipientId: string;
  recipientName: string;
  currentUserId: string;
  isTeacher: boolean;
  onBack: () => void;
}

interface Message {
  id: string;
  sender_id: string;
  texto: string;
  created_at: string;
  sender_name?: string;
  deleted?: boolean;
}

export function DMPanel({ 
  turmaId, 
  recipientId, 
  recipientName, 
  currentUserId, 
  isTeacher,
  onBack 
}: DMPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [dmId, setDmId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Find or create DM thread
  const { data: dmData, isLoading: dmLoading } = useQuery({
    queryKey: ['dm-thread', turmaId, recipientId],
    queryFn: async () => {
      // For teachers: open/create DM
      if (isTeacher) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const { data, error } = await supabase.functions.invoke('classes-dm-open', {
          body: { turma_id: turmaId, aluno_id: recipientId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) throw error;
        return data;
      } else {
        // For students: find existing DM with teacher
        const { data } = await supabase
          .from('dms')
          .select('id')
          .eq('turma_id', turmaId)
          .eq('aluno_id', currentUserId)
          .eq('teacher_id', recipientId)
          .single();
        
        return data ? { dm_pair_id: data.id } : null;
      }
    },
  });

  useEffect(() => {
    if (dmData?.dm_pair_id) {
      setDmId(dmData.dm_pair_id);
    }
  }, [dmData]);

  // Fetch messages for the DM thread
  const { data: messages = [], refetch } = useQuery({
    queryKey: ['dm-messages', turmaId, dmId],
    queryFn: async () => {
      if (!dmId) return [];

      const { data, error } = await supabase
        .from('mensagens')
        .select(`
          id,
          sender_id,
          texto,
          created_at,
          deleted
        `)
        .eq('turma_id', turmaId)
        .eq('thread_tipo', 'dm')
        .eq('thread_chave', dmId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching DM messages:', error);
        return [];
      }

      return data as Message[];
    },
    enabled: !!dmId,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Set up Realtime subscription for new messages
  useEffect(() => {
    if (!dmId || !turmaId) return;

    console.log('[DM Realtime] Setting up channel for DM:', dmId);
    
    const channel = supabase
      .channel(`dm-${dmId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `thread_chave=eq.${dmId}`,
        },
        (payload) => {
          console.log('[DM Realtime] New message received:', payload);
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mensagens',
          filter: `thread_chave=eq.${dmId}`,
        },
        (payload) => {
          console.log('[DM Realtime] Message updated:', payload);
          refetch();
        }
      )
      .subscribe((status) => {
        console.log('[DM Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[DM Realtime] Cleaning up channel');
      supabase.removeChannel(channel);
    };
  }, [dmId, turmaId, refetch]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message mutation - uses dm-send which creates proper notifications
  const sendMessage = useMutation({
    mutationFn: async (texto: string) => {
      if (!dmId) throw new Error('DM thread not found');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('dm-send', {
        body: {
          turma_id: turmaId,
          dm_id: dmId,
          texto,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setNewMessage('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['dm-messages', turmaId, dmId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao enviar mensagem');
    },
  });

  // Delete message mutation (soft delete)
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('mensagens')
        .update({ deleted: true })
        .eq('id', messageId)
        .eq('sender_id', currentUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['dm-messages', turmaId, dmId] });
      toast.success('Mensagem apagada');
    },
    onError: () => {
      toast.error('Erro ao apagar mensagem');
    },
  });

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (dmLoading) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <p className="text-muted-foreground">Carregando conversa...</p>
      </Card>
    );
  }

  return (
    <Card className="h-[500px] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{recipientName}</p>
          <p className="text-xs text-muted-foreground">
            {isTeacher ? 'Aluno' : 'Professor'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma mensagem ainda.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Envie a primeira mensagem!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === currentUserId;
              const isDeleted = msg.deleted;
              
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2 relative group',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md',
                      isDeleted && 'opacity-60 italic'
                    )}
                  >
                    {isDeleted ? (
                      <p className="text-sm">🚫 Mensagem apagada</p>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.texto}</p>
                        {isOwn && !isDeleted && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
                                  "hover:bg-destructive/10 hover:text-destructive"
                                )}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A mensagem será marcada como apagada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMessage.mutate(msg.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Apagar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    )}
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={sendMessage.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
