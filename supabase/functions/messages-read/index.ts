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

    const body = await req.json();
    const { thread_id, last_read_message_id } = body;

    // Validar input
    if (!thread_id || !last_read_message_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'thread_id e last_read_message_id são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é participante da thread
    const { data: thread } = await supabaseClient
      .from('threads')
      .select('*')
      .eq('id', thread_id)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .single();

    if (!thread) {
      return new Response(
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Você não tem permissão para acessar esta conversa.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a mensagem existe e pertence a esta thread
    const { data: message } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('id', last_read_message_id)
      .eq('thread_id', thread_id)
      .single();

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'Mensagem não encontrada.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar read receipt
    const { error: upsertError } = await supabaseClient
      .from('read_receipts')
      .upsert({
        thread_id,
        user_id: user.id,
        last_read_message_id,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('Error updating read receipt:', upsertError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro ao atualizar leitura.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Read receipt updated for thread:', thread_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Leitura atualizada com sucesso.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in messages-read:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
