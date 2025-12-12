import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AnnouncementMode = 'general' | 'direct_assignment';

interface CreateAnnouncementRequest {
  class_id: string;
  title: string;
  body: string;
  pinned?: boolean;
  mode?: AnnouncementMode;
  target_student_ids?: string[];
  assignment_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Token de autorização não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with the user's auth context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('User lookup result:', { userId: user?.id, error: authError?.message });
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: CreateAnnouncementRequest = await req.json();
    const { 
      class_id, 
      title, 
      body, 
      pinned = false, 
      mode = 'general',
      target_student_ids = [],
      assignment_id 
    } = payload;

    console.log('Payload received:', { class_id, title, mode, target_student_ids, assignment_id });

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

    // Validate direct_assignment mode
    if (mode === 'direct_assignment') {
      if (!target_student_ids || target_student_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Selecione pelo menos um aluno' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!assignment_id) {
        return new Response(
          JSON.stringify({ error: 'Selecione uma atribuição' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verificar se é owner da turma (check both classes and turmas tables for compatibility)
    let isOwner = false;
    let turmaNome = '';
    
    // First try turmas table (new system)
    const { data: turmaData, error: turmaError } = await supabase
      .from('turmas')
      .select('owner_teacher_id, nome')
      .eq('id', class_id)
      .maybeSingle();

    if (turmaData) {
      isOwner = turmaData.owner_teacher_id === user.id;
      turmaNome = turmaData.nome;
    } else {
      // Fallback to classes table (legacy)
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('owner_id, name')
        .eq('id', class_id)
        .maybeSingle();

      if (classData) {
        isOwner = classData.owner_id === user.id;
        turmaNome = classData.name;
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

    // Get assignment title if in direct_assignment mode
    let assignmentTitle = '';
    if (mode === 'direct_assignment' && assignment_id) {
      const { data: atribData } = await supabase
        .from('atribuicoes')
        .select('titulo')
        .eq('id', assignment_id)
        .single();
      
      if (atribData) {
        assignmentTitle = atribData.titulo;
      }
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

    // Determine recipient list based on mode
    let recipientIds: string[] = [];

    if (mode === 'direct_assignment') {
      // Direct assignment mode: only selected students
      recipientIds = target_student_ids;
      console.log('Direct assignment mode - recipients:', recipientIds);
    } else {
      // General mode: all students in the turma
      // First try turma_membros (new system)
      const { data: turmaMembros } = await supabase
        .from('turma_membros')
        .select('user_id')
        .eq('turma_id', class_id)
        .eq('ativo', true)
        .neq('user_id', user.id);

      if (turmaMembros && turmaMembros.length > 0) {
        recipientIds = turmaMembros.map(m => m.user_id);
      } else {
        // Fallback to class_members (legacy)
        const { data: classMembers } = await supabase
          .from('class_members')
          .select('user_id')
          .eq('class_id', class_id)
          .eq('status', 'active')
          .neq('user_id', user.id);

        if (classMembers) {
          recipientIds = classMembers.map(m => m.user_id);
        }
      }
      console.log('General mode - recipients:', recipientIds.length);
    }

    // Create notifications in the correct table: notificacoes (Portuguese)
    if (recipientIds.length > 0) {
      const notificationType = mode === 'direct_assignment' ? 'aviso_atribuicao' : 'aviso';
      
      const notifications = recipientIds.map((userId) => ({
        recipient_id: userId,
        tipo: notificationType,
        titulo: `Aviso de ${turmaNome}`,
        mensagem: title.trim(),
        lida: false,
        metadata: {
          announcement_id: announcement.id,
          full_body: body.trim(),
          turma_nome: turmaNome,
          turma_id: class_id,
          ...(mode === 'direct_assignment' && {
            assignment_id: assignment_id,
            assignment_title: assignmentTitle,
          }),
        },
      }));

      const { error: notifError } = await supabase.from('notificacoes').insert(notifications);
      
      if (notifError) {
        console.error('Error inserting notifications:', notifError);
        // Don't fail the request, just log the error
      } else {
        console.log(`Created ${notifications.length} notifications in notificacoes table`);
      }
    }

    console.log('Announcement created:', announcement.id, 'Mode:', mode);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: mode === 'direct_assignment' 
          ? `Aviso enviado para ${recipientIds.length} aluno(s)!`
          : 'Aviso enviado para todos os alunos!',
        announcement,
        recipients_count: recipientIds.length,
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
