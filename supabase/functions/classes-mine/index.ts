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
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    // Buscar turmas do usuário (como membro)
    let query = supabaseClient
      .from('class_members')
      .select(`
        class_id,
        role,
        joined_at,
        classes!inner(
          id,
          name,
          code,
          visibility,
          created_at,
          owner_id
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('joined_at', cursor);
    }

    const { data: memberships, error: memberError } = await query;

    if (memberError) {
      console.error('Error fetching memberships:', memberError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao buscar turmas.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Contar mensagens não lidas para cada turma
    const classesWithUnread = await Promise.all(
      (memberships || []).map(async (membership) => {
        const classData = membership.classes;

        // Buscar threads do usuário nesta turma
        const { data: threads } = await supabaseClient
          .from('threads')
          .select('id')
          .eq('class_id', classData.id)
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

        let unreadCount = 0;

        if (threads && threads.length > 0) {
          for (const thread of threads) {
            // Buscar último recibo de leitura
            const { data: receipt } = await supabaseClient
              .from('read_receipts')
              .select('last_read_message_id')
              .eq('thread_id', thread.id)
              .eq('user_id', user.id)
              .single();

            // Contar mensagens não lidas
            const { count } = await supabaseClient
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('thread_id', thread.id)
              .neq('sender_id', user.id);

            if (receipt?.last_read_message_id) {
              const { count: unreadInThread } = await supabaseClient
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('thread_id', thread.id)
                .neq('sender_id', user.id)
                .gt('created_at', receipt.last_read_message_id);

              unreadCount += unreadInThread || 0;
            } else {
              unreadCount += count || 0;
            }
          }
        }

        return {
          id: classData.id,
          name: classData.name,
          code: classData.code,
          role: membership.role,
          joined_at: membership.joined_at,
          is_owner: classData.owner_id === user.id,
          unread_count: unreadCount,
        };
      })
    );

    const nextCursor = memberships && memberships.length === limit 
      ? memberships[memberships.length - 1].joined_at 
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        classes: classesWithUnread,
        next_cursor: nextCursor,
        has_more: !!nextCursor,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in classes-mine:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
