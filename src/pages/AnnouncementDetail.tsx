import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMessages } from '@/hooks/useMessages';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface AnnouncementData {
  id: string;
  class_id: string;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  profiles?: {
    first_name: string | null;
  };
}

export default function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const { messages, sendMessage, fetchMessages } = useMessages(threadId || '');

  useEffect(() => {
    if (!id) return;

    const loadAnnouncement = async () => {
      try {
        setLoading(true);

        // Buscar anúncio
        const { data: announcementData, error: announcementError } = await supabase
          .from('announcements')
          .select('*')
          .eq('id', id)
          .is('archived_at', null)
          .single();

        if (announcementError) throw announcementError;
        
        // Buscar perfil do autor
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', announcementData.author_id)
          .single();
        
        setAnnouncement({
          ...announcementData,
          profiles: profileData,
        });

        // Buscar/criar thread de comentários
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threads-for-announcement`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({ announcement_id: id }),
          }
        );

        if (!response.ok) throw new Error('Erro ao carregar comentários');

        const result = await response.json();
        if (result.success && result.thread) {
          setThreadId(result.thread.id);
        }
      } catch (error: any) {
        console.error('Error loading announcement:', error);
        toast.error(error.message || 'Erro ao carregar anúncio');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncement();
  }, [id, navigate]);

  useEffect(() => {
    if (threadId) {
      fetchMessages();
    }
  }, [threadId, fetchMessages]);

  const handleSendComment = async () => {
    if (!commentText.trim() || !threadId) return;

    try {
      setSending(true);
      await sendMessage(commentText.trim());
      setCommentText('');
    } catch (error) {
      // Error handled by hook
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <p>Anúncio não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {/* Anúncio */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            {announcement.pinned && (
              <Pin className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            )}
            <h1 className="text-2xl font-bold flex-1">{announcement.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            {announcement.profiles?.first_name || 'Professor'} •{' '}
            {formatDistanceToNow(new Date(announcement.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
          <p className="whitespace-pre-wrap">{announcement.body}</p>
        </Card>

        {/* Comentários */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Comentários ({messages.length})
          </h2>

          {messages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem comentários.</p>
          ) : (
            <div className="space-y-4 mb-6">
              {messages.map((msg) => (
                <Card key={msg.id} className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {formatDistanceToNow(new Date(msg.sent_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Composer */}
          <Card className="p-4">
            <Textarea
              placeholder="Escreva um comentário..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              className="mb-3"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSendComment}
                disabled={!commentText.trim() || sending}
              >
                {sending ? 'Enviando...' : 'Comentar'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
