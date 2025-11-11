import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  body: string;
  is_mine: boolean;
  sent_at: string;
  seen?: boolean;
  status?: 'sending' | 'sent' | 'failed';
  client_msg_id?: string;
}

export function useMessages(threadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Você precisa estar logado.');
        return;
      }

      const response = await supabase.functions.invoke('messages-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { thread_id: threadId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        setMessages(response.data.messages.map((msg: any) => ({
          ...msg,
          status: 'sent',
        })) || []);
      } else {
        throw new Error(response.data?.message || 'Erro ao buscar mensagens');
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Erro ao buscar mensagens');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = async (body: string) => {
    if (!threadId || !body.trim()) return;

    const clientMsgId = uuidv4();
    const tempMessage: Message = {
      id: clientMsgId,
      body: body.trim(),
      is_mine: true,
      sent_at: new Date().toISOString(),
      status: 'sending',
      client_msg_id: clientMsgId,
    };

    // Adicionar mensagem temporária
    setMessages(prev => [...prev, tempMessage]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado.');
      }

      const response = await supabase.functions.invoke('messages-send', {
        body: {
          thread_id: threadId,
          client_msg_id: clientMsgId,
          body: body.trim(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        // Atualizar status da mensagem
        setMessages(prev =>
          prev.map(msg =>
            msg.client_msg_id === clientMsgId
              ? { ...msg, id: response.data.message_id, sent_at: response.data.sent_at, status: 'sent' }
              : msg
          )
        );
      } else {
        throw new Error(response.data?.message || 'Falha ao enviar. Tentar novamente?');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      
      // Marcar mensagem como falha
      setMessages(prev =>
        prev.map(msg =>
          msg.client_msg_id === clientMsgId ? { ...msg, status: 'failed' } : msg
        )
      );
      
      toast.error(err.message || 'Falha ao enviar. Tentar novamente?');
    }
  };

  const retryMessage = async (clientMsgId: string) => {
    const failedMsg = messages.find(m => m.client_msg_id === clientMsgId);
    if (!failedMsg) return;

    // Atualizar status para sending
    setMessages(prev =>
      prev.map(msg =>
        msg.client_msg_id === clientMsgId ? { ...msg, status: 'sending' } : msg
      )
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado.');
      }

      const response = await supabase.functions.invoke('messages-send', {
        body: {
          thread_id: threadId,
          client_msg_id: clientMsgId,
          body: failedMsg.body,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        setMessages(prev =>
          prev.map(msg =>
            msg.client_msg_id === clientMsgId
              ? { ...msg, id: response.data.message_id, sent_at: response.data.sent_at, status: 'sent' }
              : msg
          )
        );
        toast.success('Mensagem enviada!');
      } else {
        throw new Error(response.data?.message || 'Falha ao enviar.');
      }
    } catch (err: any) {
      console.error('Error retrying message:', err);
      setMessages(prev =>
        prev.map(msg =>
          msg.client_msg_id === clientMsgId ? { ...msg, status: 'failed' } : msg
        )
      );
      toast.error(err.message || 'Falha ao reenviar.');
    }
  };

  const markAsRead = async (lastMessageId: string) => {
    if (!threadId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('messages-read', {
        body: {
          thread_id: threadId,
          last_read_message_id: lastMessageId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    retryMessage,
    markAsRead,
    refetch: fetchMessages,
    fetchMessages,
  };
}
