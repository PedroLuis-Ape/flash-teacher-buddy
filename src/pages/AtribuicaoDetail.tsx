import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChatMessages, useSendMessage } from '@/hooks/useMensagens';
import { ChatComposer } from '@/components/ChatComposer';
import { MessageBubble } from '@/components/MessageBubble';
import { safeFormatDate } from '@/lib/dateUtils';

export default function AtribuicaoDetail() {
  const { turmaId, atribuicaoId } = useParams<{ turmaId: string; atribuicaoId: string }>();
  const navigate = useNavigate();

  const { data: atribData, isLoading } = useQuery({
    queryKey: ['atribuicao', atribuicaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('atribuicoes')
        .select('*')
        .eq('id', atribuicaoId)
        .single();
      return data;
    },
  });

  const { data: chatData } = useChatMessages(
    turmaId || null,
    'atribuicao',
    atribuicaoId || ''
  );

  const sendMessage = useSendMessage();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const atribuicao = atribData;

  if (!atribuicao) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Atribuição não encontrada</p>
      </div>
    );
  }

  const messages = chatData?.messages || [];

  const handleSendComment = async (texto: string) => {
    if (!turmaId || !atribuicaoId) return;
    await sendMessage.mutateAsync({
      turma_id: turmaId,
      thread_tipo: 'atribuicao',
      thread_chave: atribuicaoId,
      texto,
    });
  };

  // FIX: Use fonte_id (the actual copied content ID) for navigation
  const handleOpenContent = () => {
    if (!atribuicao.fonte_id) {
      return;
    }
    
    if (atribuicao.fonte_tipo === 'lista') {
      navigate(`/list/${atribuicao.fonte_id}`);
    } else if (atribuicao.fonte_tipo === 'pasta') {
      navigate(`/folder/${atribuicao.fonte_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{atribuicao.titulo}</h1>
          </div>
          <Button onClick={handleOpenContent} className="shrink-0">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Conteúdo
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* IMPROVED: Make entire card clickable on mobile */}
        <Card 
          className="p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleOpenContent}
        >
          <div className="space-y-4">
            {atribuicao.descricao && (
              <div>
                <h3 className="font-semibold mb-2">Descrição</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {atribuicao.descricao}
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <Badge variant="outline">{atribuicao.fonte_tipo}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pontos</p>
                <p className="font-semibold">{atribuicao.pontos_vale}</p>
              </div>
              {atribuicao.data_limite && (
                <div>
                  <p className="text-sm text-muted-foreground">Prazo</p>
                  <p className="font-semibold">
                    {safeFormatDate(atribuicao.data_limite)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Comentários</h3>
          <div className="space-y-4">
            <Card className="h-[400px] flex flex-col">
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum comentário ainda.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Seja o primeiro a comentar!
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
              <ChatComposer onSend={handleSendComment} />
            </Card>
          </div>
        </Card>
      </div>
    </div>
  );
}
