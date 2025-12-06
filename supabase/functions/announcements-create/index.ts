import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAnnouncementRequest {
  class_id: string;
  title: string;
  body: string;
  pinned?: boolean;
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

    const payload: CreateAnnouncementRequest = await req.json();
    const { class_id, title, body, pinned = false } = payload;

    // Validar inputs
    if (!class_id || !title?.trim() || !body?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (title.trim().length > 200) {
      return new Response(
        JSON.stringify({ error: 'Título muito longo (máx 200 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.trim().length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Corpo muito longo (máx 5000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é owner da turma (check both classes and turmas tables for compatibility)
    let isOwner = false;
    
    // First try turmas table (new system)
    const { data: turmaData, error: turmaError } = await supabase
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', class_id)
      .maybeSingle();

    if (turmaData) {
      isOwner = turmaData.owner_teacher_id === user.id;
    } else {
      // Fallback to classes table (legacy)
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('owner_id')
        .eq('id', class_id)
        .maybeSingle();

      if (classData) {
        isOwner = classData.owner_id === user.id;
      }
    }

    if (!turmaData && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Turma não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar anúncio
    const { data: announcement, error: insertError } = await supabase
      .from('announcements')
      .insert({
        class_id,
        author_id: user.id,
        title: title.trim(),
        body: body.trim(),
        pinned,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting announcement:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar anúncio' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar notificações para todos os membros (check both turma_membros and class_members)
    let memberIds: string[] = [];

    // First try turma_membros (new system)
    const { data: turmaMembros } = await supabase
      .from('turma_membros')
      .select('user_id')
      .eq('turma_id', class_id)
      .eq('ativo', true)
      .neq('user_id', user.id);

    if (turmaMembros && turmaMembros.length > 0) {
      memberIds = turmaMembros.map(m => m.user_id);
    } else {
      // Fallback to class_members (legacy)
      const { data: classMembers } = await supabase
        .from('class_members')
        .select('user_id')
        .eq('class_id', class_id)
        .eq('status', 'active')
        .neq('user_id', user.id);

      if (classMembers) {
        memberIds = classMembers.map(m => m.user_id);
      }
    }

    if (memberIds.length > 0) {
      const notifications = memberIds.map((userId) => ({
        user_id: userId,
        type: 'announcement',
        ref_type: 'announcement',
        ref_id: announcement.id,
      }));

      await supabase.from('notifications').insert(notifications);
    }

    console.log('Announcement created:', announcement.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Anúncio criado.',
        announcement 
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
