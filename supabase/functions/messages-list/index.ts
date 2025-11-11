import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'UNAUTHORIZED', message: 'Você precisa estar logado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const threadId = url.searchParams.get('thread_id');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    if (!threadId) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'thread_id é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é participante da thread
    const { data: thread } = await supabaseClient
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .single();

    if (!thread) {
      return new Response(
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Você não tem permissão para acessar esta conversa.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar mensagens
    let query = supabaseClient
      .from('messages')
      .select('id, body, sender_id, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao buscar mensagens.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar read receipt do outro usuário
    const otherUserId = thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;
    const { data: otherReceipt } = await supabaseClient
      .from('read_receipts')
      .select('last_read_message_id')
      .eq('thread_id', threadId)
      .eq('user_id', otherUserId)
      .single();

    // Marcar mensagens com status de leitura
    const enrichedMessages = (messages || []).map(msg => ({
      id: msg.id,
      body: msg.body,
      is_mine: msg.sender_id === user.id,
      sent_at: msg.created_at,
      seen: msg.sender_id === user.id && otherReceipt?.last_read_message_id 
        ? msg.created_at <= otherReceipt.last_read_message_id 
        : false,
    }));

    // Inverter ordem para mostrar mais antigas primeiro
    enrichedMessages.reverse();

    const nextCursor = messages && messages.length === limit 
      ? messages[messages.length - 1].created_at 
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        messages: enrichedMessages,
        next_cursor: nextCursor,
        has_more: !!nextCursor,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in messages-list:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
