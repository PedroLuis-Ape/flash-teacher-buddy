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
    const classId = url.searchParams.get('class_id');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    if (!classId) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'class_id é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é membro ativo
    const { data: member } = await supabaseClient
      .from('class_members')
      .select('*')
      .eq('class_id', classId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar threads do usuário
    let query = supabaseClient
      .from('threads')
      .select('*')
      .eq('class_id', classId)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: threads, error: threadsError } = await query;

    if (threadsError) {
      console.error('Error fetching threads:', threadsError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao buscar threads.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enriquecer threads com informações do outro usuário e última mensagem
    const enrichedThreads = await Promise.all(
      (threads || []).map(async (thread) => {
        const otherUserId = thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;

        // Buscar perfil do outro usuário
        const { data: otherUser } = await supabaseClient
          .from('profiles')
          .select('first_name, user_type')
          .eq('id', otherUserId)
          .single();

        // Buscar última mensagem
        const { data: lastMessage } = await supabaseClient
          .from('messages')
          .select('body, created_at, sender_id')
          .eq('thread_id', thread.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Buscar mensagens não lidas
        const { data: receipt } = await supabaseClient
          .from('read_receipts')
          .select('last_read_message_id')
          .eq('thread_id', thread.id)
          .eq('user_id', user.id)
          .single();

        const { count: unreadCount } = await supabaseClient
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('thread_id', thread.id)
          .neq('sender_id', user.id)
          .gt('created_at', receipt?.last_read_message_id || '1970-01-01');

        return {
          thread_id: thread.id,
          other_user: {
            id: otherUserId,
            name: otherUser?.first_name || 'Usuário',
            user_type: otherUser?.user_type,
          },
          last_message: lastMessage ? {
            body: lastMessage.body,
            sent_at: lastMessage.created_at,
            is_mine: lastMessage.sender_id === user.id,
          } : null,
          unread_count: unreadCount || 0,
          created_at: thread.created_at,
        };
      })
    );

    const nextCursor = threads && threads.length === limit 
      ? threads[threads.length - 1].created_at 
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        threads: enrichedThreads,
        next_cursor: nextCursor,
        has_more: !!nextCursor,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in threads-list:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
