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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const turma_id = url.searchParams.get('turma_id');
    const thread_tipo = url.searchParams.get('thread_tipo');
    const thread_chave = url.searchParams.get('thread_chave');
    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!turma_id || !thread_tipo || !thread_chave) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let query = supabaseClient
      .from('mensagens')
      .select(`
        *,
        profiles:sender_id(first_name, avatar_skin_id)
      `)
      .eq('turma_id', turma_id)
      .eq('thread_tipo', thread_tipo)
      .eq('thread_chave', thread_chave)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasMore = messages && messages.length === limit;
    const nextCursor = messages && messages.length > 0 
      ? messages[messages.length - 1].created_at 
      : null;

    return new Response(
      JSON.stringify({ 
        messages: messages || [], 
        has_more: hasMore,
        next_cursor: nextCursor,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});