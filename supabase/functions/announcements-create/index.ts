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
    console.log('[announcements-create] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[announcements-create] Tentativa de acesso SEM header Authorization');
      return new Response(
        JSON.stringify({ error: 'Token de autorização não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Cliente USUÁRIO (respeita RLS): Para verificar quem é o professor e criar o anúncio
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // 2. Cliente ADMIN (Service Role): Para inserir notificações para os alunos (ignora RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    console.log('[announcements-create] User lookup:', { userId: user?.id, error: authError?.message });
    
    if (authError || !user) {
      console.error('[announcements-create] Tentativa de acesso sem usuário autenticado:', {
        error: authError?.message,
        hasUser: !!user,
        headerPresent: !!authHeader,
      });
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

    console.log('[announcements-create] Payload:', { class_id, title, mode, target_student_ids_count: target_student_ids.length, assignment_id });

    // Validar inputs
    if (!class_id || !title?.trim() || !body?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos: class_id, title e body são obrigatórios' }),
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

    // Verificar se é owner da turma (usando cliente do usuário para segurança)
    let isOwner = false;
    let turmaNome = '';
    
    // First try turmas table (new system)
    const { data: turmaData } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id, nome')
      .eq('id', class_id)
      .maybeSingle();

    if (turmaData) {
      isOwner = turmaData.owner_teacher_id === user.id;
      turmaNome = turmaData.nome;
      console.log('[announcements-create] Turma found:', { nome: turmaNome, isOwner });
    } else {
      // Fallback to classes table (legacy)
      const { data: classData } = await supabaseClient
        .from('classes')
        .select('owner_id, name')
        .eq('id', class_id)
        .maybeSingle();

      if (classData) {
        isOwner = classData.owner_id === user.id;
        turmaNome = classData.name;
        console.log('[announcements-create] Class found (legacy):', { name: turmaNome, isOwner });
      }
    }

    if (!turmaData && !isOwner) {
      console.error('[announcements-create] Turma não encontrada:', class_id);
      return new Response(
        JSON.stringify({ error: 'Turma não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isOwner) {
      console.error('[announcements-create] Usuário não é owner:', { userId: user.id, class_id });
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get assignment title if in direct_assignment mode
    let assignmentTitle = '';
    if (mode === 'direct_assignment' && assignment_id) {
      const { data: atribData } = await supabaseClient
        .from('atribuicoes')
        .select('titulo')
        .eq('id', assignment_id)
        .single();
      
      if (atribData) {
        assignmentTitle = atribData.titulo;
        console.log('[announcements-create] Assignment found:', assignmentTitle);
      }
    }

    // Criar anúncio (usando cliente do usuário - autor é o professor)
    const { data: announcement, error: insertError } = await supabaseClient
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
      console.error('[announcements-create] Error inserting announcement:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar anúncio' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[announcements-create] Announcement created:', announcement.id);

    // Determine recipient list based on mode
    let recipientIds: string[] = [];

    if (mode === 'direct_assignment') {
      // Direct assignment mode: only selected students
      recipientIds = target_student_ids;
      console.log('[announcements-create] Direct assignment mode - recipients:', recipientIds.length);
    } else {
      // General mode: all students in the turma
      // Usamos supabaseAdmin aqui para garantir que vemos todos os alunos
      const { data: turmaMembros, error: membrosError } = await supabaseAdmin
        .from('turma_membros')
        .select('user_id')
        .eq('turma_id', class_id)
        .eq('ativo', true)
        .neq('user_id', user.id);

      if (membrosError) {
        console.error('[announcements-create] Error fetching turma_membros:', membrosError);
      }

      if (turmaMembros && turmaMembros.length > 0) {
        recipientIds = turmaMembros.map(m => m.user_id);
        console.log('[announcements-create] Found turma_membros:', recipientIds.length);
      } else {
        // Fallback to class_members (legacy)
        const { data: classMembers, error: classMembersError } = await supabaseAdmin
          .from('class_members')
          .select('user_id')
          .eq('class_id', class_id)
          .eq('status', 'active')
          .neq('user_id', user.id);

        if (classMembersError) {
          console.error('[announcements-create] Error fetching class_members:', classMembersError);
        }

        if (classMembers && classMembers.length > 0) {
          recipientIds = classMembers.map(m => m.user_id);
          console.log('[announcements-create] Found class_members (legacy):', recipientIds.length);
        }
      }
    }

    // *** CORREÇÃO PRINCIPAL: Usar supabaseAdmin para inserir notificações ***
    // O professor não tem permissão RLS para inserir notificações para outros usuários
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

      console.log('[announcements-create] Inserting notifications via ADMIN client...');
      
      // *** USA SUPABASE ADMIN PARA IGNORAR RLS ***
      const { error: notifError } = await supabaseAdmin
        .from('notificacoes')
        .insert(notifications);
      
      if (notifError) {
        console.error('[announcements-create] CRITICAL: Error inserting notifications:', notifError);
        // Não falha a requisição, apenas loga o erro
      } else {
        console.log(`[announcements-create] SUCCESS: Created ${notifications.length} notifications via Admin`);
      }
    } else {
      console.log('[announcements-create] No recipients found for notifications');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: mode === 'direct_assignment' 
          ? `Aviso enviado para ${recipientIds.length} aluno(s)!`
          : recipientIds.length > 0 
            ? `Aviso enviado para ${recipientIds.length} alunos!`
            : 'Aviso criado (nenhum aluno na turma)',
        announcement,
        recipients_count: recipientIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[announcements-create] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
