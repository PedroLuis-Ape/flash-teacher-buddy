import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateThreadRequest {
  announcement_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: CreateThreadRequest = await req.json();
    const { announcement_id } = payload;

    if (!announcement_id) {
      return new Response(
        JSON.stringify({ error: 'announcement_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar anúncio
    const { data: announcement, error: announcementError } = await supabase
      .from('announcements')
      .select('id, class_id, author_id')
      .eq('id', announcement_id)
      .is('archived_at', null)
      .single();

    if (announcementError || !announcement) {
      return new Response(
        JSON.stringify({ error: 'Anúncio não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é membro da turma
    const { data: membership } = await supabase
      .from('class_members')
      .select('user_id')
      .eq('class_id', announcement.class_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const { data: classData } = await supabase
      .from('classes')
      .select('owner_id')
      .eq('id', announcement.class_id)
      .single();

    if (!membership && classData?.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar thread existente (idempotente)
    const { data: existingThread } = await supabase
      .from('threads')
      .select('*')
      .eq('announcement_id', announcement_id)
      .eq('type', 'announcement')
      .maybeSingle();

    if (existingThread) {
      return new Response(
        JSON.stringify({
          success: true,
          thread: existingThread,
          existed: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar nova thread
    const { data: newThread, error: insertError } = await supabase
      .from('threads')
      .insert({
        class_id: announcement.class_id,
        type: 'announcement',
        announcement_id,
        user_a_id: announcement.author_id,
        user_b_id: announcement.author_id, // Placeholder, todos podem comentar
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating thread:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar thread' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Thread created for announcement:', announcement_id);

    return new Response(
      JSON.stringify({
        success: true,
        thread: newThread,
        existed: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
