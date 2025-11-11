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
    const { thread_id, client_msg_id, body: messageBody } = body;

    // Validar input
    if (!thread_id || !client_msg_id || !messageBody) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'thread_id, client_msg_id e body são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Mensagem não pode ser vazia.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (messageBody.length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Mensagem muito longa (máx. 5000 caracteres).' }),
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
        JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Você não tem permissão para enviar mensagens nesta conversa.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar idempotência - se já existe mensagem com este client_msg_id
    const { data: existingMsg } = await supabaseClient
      .from('messages')
      .select('id, created_at')
      .eq('sender_id', user.id)
      .eq('client_msg_id', client_msg_id)
      .single();

    if (existingMsg) {
      console.log('Message already sent (idempotent):', existingMsg.id);
      return new Response(
        JSON.stringify({
          success: true,
          message_id: existingMsg.id,
          sent_at: existingMsg.created_at,
          idempotent: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitizar body (remover HTML executável)
    const sanitizedBody = messageBody.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Inserir mensagem
    const { data: newMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert({
        thread_id,
        sender_id: user.id,
        body: sanitizedBody,
        client_msg_id,
      })
      .select()
      .single();

    if (insertError || !newMessage) {
      // Verificar se é erro de duplicação (race condition)
      if (insertError?.code === '23505') {
        const { data: retryMsg } = await supabaseClient
          .from('messages')
          .select('id, created_at')
          .eq('sender_id', user.id)
          .eq('client_msg_id', client_msg_id)
          .single();

        if (retryMsg) {
          return new Response(
            JSON.stringify({
              success: true,
              message_id: retryMsg.id,
              sent_at: retryMsg.created_at,
              idempotent: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.error('Error inserting message:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Falha ao enviar. Tentar novamente?' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar read receipt do remetente
    await supabaseClient
      .from('read_receipts')
      .upsert({
        thread_id,
        user_id: user.id,
        last_read_message_id: newMessage.id,
        updated_at: new Date().toISOString(),
      });

    console.log('Message sent:', newMessage.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: newMessage.id,
        sent_at: newMessage.created_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in messages-send:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
