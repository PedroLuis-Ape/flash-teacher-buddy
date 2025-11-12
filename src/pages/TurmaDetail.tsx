import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users as UsersIcon, BookOpen, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAtribuicoesByTurma } from '@/hooks/useAtribuicoes';
import { useChatMessages, useSendMessage } from '@/hooks/useMensagens';
import { ChatComposer } from '@/components/ChatComposer';
import { MessageBubble } from '@/components/MessageBubble';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TurmaDetail() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('atribuicoes');

  const { data: turmaData, isLoading: turmaLoading } = useQuery({
    queryKey: ['turma', turmaId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: turma } = await supabase
        .from('turmas')
        .select('*, turma_membros(*, profiles(first_name, avatar_skin_id, ape_id))')
        .eq('id', turmaId)
        .single();

      const isOwner = turma?.owner_teacher_id === user.id;

      return { turma, isOwner };
    },
  });

  const { data: atribuicoesData } = useAtribuicoesByTurma(turmaId || null);
  const { data: chatData } = useChatMessages(turmaId || null, 'turma', turmaId || '');
  const sendMessage = useSendMessage();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  if (turmaLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const turma = turmaData?.turma;
  const isOwner = turmaData?.isOwner || false;

  if (!turma) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Turma não encontrada</p>
      </div>
    );
  }

  const atribuicoes = atribuicoesData?.atribuicoes || [];
  const messages = chatData?.messages || [];
  const membros = turma.turma_membros || [];

  const handleSendMessage = async (texto: string) => {
    if (!turmaId) return;
    await sendMessage.mutateAsync({
      turma_id: turmaId,
      thread_tipo: 'turma',
      thread_chave: turmaId,
      texto,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/turmas/professor')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{turma.nome}</h1>
              {turma.descricao && (
                <p className="text-sm text-muted-foreground">{turma.descricao}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="atribuicoes">
              <BookOpen className="h-4 w-4 mr-2" />
              Atribuições
            </TabsTrigger>
            <TabsTrigger value="pessoas">
              <UsersIcon className="h-4 w-4 mr-2" />
              Pessoas
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="atribuicoes" className="space-y-4 mt-4">
            {atribuicoes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma atribuição ainda.</p>
              </Card>
            ) : (
              atribuicoes.map((atrib: any) => (
                <Card
                  key={atrib.id}
                  className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/turmas/${turmaId}/atribuicoes/${atrib.id}`)}
                >
                  <h3 className="font-semibold">{atrib.titulo}</h3>
                  {atrib.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{atrib.descricao}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline">{atrib.fonte_tipo}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {atrib.pontos_vale} pontos
                    </span>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pessoas" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Membros ({membros.length})</h3>
              <div className="space-y-2">
                {membros.map((membro: any) => (
                  <div key={membro.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                    <div>
                      <p className="font-medium">{membro.profiles?.first_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">
                        APE ID: {membro.profiles?.ape_id || 'N/A'}
                      </p>
                    </div>
                    <Badge variant={membro.role === 'aluno' ? 'secondary' : 'default'}>
                      {membro.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Card className="h-[500px] flex flex-col">
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma mensagem ainda.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Seja o primeiro a enviar uma mensagem!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col-reverse">
                    {messages.map((msg: any) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.sender_id === currentUser?.id}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
              <ChatComposer onSend={handleSendMessage} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}