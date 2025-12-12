import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Basic HTML sanitization
function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

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

    const { turma_id, thread_tipo, thread_chave, texto, anexos } = await req.json();

    // Validate input
    if (!turma_id || !thread_tipo || !thread_chave || !texto) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (texto.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Texto muito longo (máx 2000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const threadKey = `${turma_id}:${thread_tipo}:${thread_chave}`;
    const { data: rateLimitOk } = await supabaseClient.rpc('check_message_rate_limit', {
      _user_id: user.id,
      _thread_key: threadKey,
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Muitas mensagens. Aguarde um momento.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize text
    const sanitizedText = sanitizeText(texto);

    // Insert message
    const { data: message, error: insertError } = await supabaseClient
      .from('mensagens')
      .insert({
        turma_id,
        thread_tipo,
        thread_chave,
        sender_id: user.id,
        texto: sanitizedText,
        anexos: anexos || null,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error sending message:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch sender profile separately (no FK in mensagens)
    const { data: senderProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, avatar_skin_id')
      .eq('id', user.id)
      .single();

    const messageWithSender = {
      ...message,
      sender: senderProfile || { first_name: 'Usuário', avatar_skin_id: null }
    };

    return new Response(
      JSON.stringify({ message: messageWithSender }),
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