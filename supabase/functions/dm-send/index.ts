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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Admin client for notifications
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // User client for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { turma_id, dm_id, texto } = await req.json();

    // Validate input
    if (!turma_id || !dm_id || !texto) {
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

    // Get DM details to find recipient
    const { data: dm, error: dmError } = await supabaseAdmin
      .from('dms')
      .select('teacher_id, aluno_id, turma_id')
      .eq('id', dm_id)
      .single();

    if (dmError || !dm) {
      console.error('Error finding DM:', dmError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is part of this DM
    if (user.id !== dm.teacher_id && user.id !== dm.aluno_id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem acesso a esta conversa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine recipient
    const recipientId = user.id === dm.teacher_id ? dm.aluno_id : dm.teacher_id;
    const isTeacherSending = user.id === dm.teacher_id;

    // Check rate limit
    const threadKey = `${turma_id}:dm:${dm_id}`;
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
    const { data: message, error: insertError } = await supabaseAdmin
      .from('mensagens')
      .insert({
        turma_id,
        thread_tipo: 'dm',
        thread_chave: dm_id,
        sender_id: user.id,
        texto: sanitizedText,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error sending message:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender name
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single();

    const senderName = senderProfile?.first_name || (isTeacherSending ? 'Professor' : 'Aluno');

    // Get turma name
    const { data: turma } = await supabaseAdmin
      .from('turmas')
      .select('nome')
      .eq('id', turma_id)
      .single();

    const turmaNome = turma?.nome || 'Turma';

    // Create notification for recipient
    const notificationTitle = isTeacherSending 
      ? `Nova mensagem do seu professor`
      : `Nova mensagem de ${senderName}`;

    const notificationMessage = sanitizedText.length > 100 
      ? sanitizedText.slice(0, 100) + '...' 
      : sanitizedText;

    const { error: notifError } = await supabaseAdmin
      .from('notificacoes')
      .insert({
        recipient_id: recipientId,
        tipo: 'dm',
        titulo: notificationTitle,
        mensagem: notificationMessage,
        lida: false,
        metadata: {
          dm_id: dm_id,
          turma_id: turma_id,
          turma_nome: turmaNome,
          sender_id: user.id,
          sender_name: senderName,
          is_teacher_sending: isTeacherSending,
        },
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the request, just log the error
    } else {
      console.log('[dm-send] Notification created for recipient:', recipientId);
    }

    return new Response(
      JSON.stringify({ message, success: true }),
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
