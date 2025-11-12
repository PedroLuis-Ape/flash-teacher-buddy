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

    const { turma_id, thread_tipo, thread_chave, last_message_id } = await req.json();

    if (!turma_id || !thread_tipo || !thread_chave || !last_message_id) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all messages up to last_message_id in this thread
    const { data: messages } = await supabaseClient
      .from('mensagens')
      .select('id, created_at')
      .eq('turma_id', turma_id)
      .eq('thread_tipo', thread_tipo)
      .eq('thread_chave', thread_chave)
      .lte('created_at', (
        await supabaseClient
          .from('mensagens')
          .select('created_at')
          .eq('id', last_message_id)
          .single()
      ).data?.created_at || new Date().toISOString());

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert read receipts for all unread messages
    const receipts = messages.map(msg => ({
      mensagem_id: msg.id,
      user_id: user.id,
    }));

    await supabaseClient
      .from('mensagens_leituras')
      .upsert(receipts, { onConflict: 'mensagem_id,user_id' });

    return new Response(
      JSON.stringify({ success: true }),
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