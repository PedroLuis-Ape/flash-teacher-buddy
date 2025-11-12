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

    // Verify user is a teacher
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_teacher')
      .eq('id', user.id)
      .single();

    if (!profile?.is_teacher) {
      return new Response(
        JSON.stringify({ error: 'Apenas professores podem atribuir atividades' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { student_ids, titulo, descricao, fonte_tipo, fonte_id, data_limite, pontos_vale } = await req.json();

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0 || !titulo || !fonte_tipo || !fonte_id) {
      return new Response(
        JSON.stringify({ error: 'student_ids, titulo, fonte_tipo e fonte_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create individual assignments for each student
    // We'll create a "virtual turma" per assignment or store directly without turma
    // For simplicity, let's create one atribuicao per student without turma_id (direct assignment)
    
    const createdAssignments = [];
    const errors = [];

    for (const student_id of student_ids) {
      try {
        // Check if student follows this teacher
        const { data: subscription } = await supabaseClient
          .from('subscriptions')
          .select('student_id')
          .eq('teacher_id', user.id)
          .eq('student_id', student_id)
          .single();

        if (!subscription) {
          errors.push({ student_id, error: 'Aluno não segue este professor' });
          continue;
        }

        // Create atribuicao without turma_id (direct assignment)
        // Note: atribuicoes table requires turma_id as NOT NULL based on schema
        // We need to handle this differently - let's create a personal "turma" or skip turma requirement
        // For now, let's create atribuicoes_status directly without atribuicao (simpler approach)
        
        // Actually, we need to respect the schema. Let's create a dummy turma or modify approach.
        // Better approach: Create assignment with a special marker or use existing turma if available
        
        // Let's check if there's a common turma between teacher and student
        const { data: teacherTurmas } = await supabaseClient
          .from('turmas')
          .select('id')
          .eq('owner_teacher_id', user.id);

        const teacherTurmaIds = teacherTurmas?.map(t => t.id) || [];

        const { data: commonTurmas } = await supabaseClient
          .from('turma_membros')
          .select('turma_id')
          .eq('user_id', student_id)
          .in('turma_id', teacherTurmaIds);

        let turma_id = null;
        if (commonTurmas && commonTurmas.length > 0) {
          turma_id = commonTurmas[0].turma_id;
        } else {
          // Create a personal "direct assignment" turma for this teacher-student pair
          // Or we can skip this and just use atribuicoes_status without atribuicao
          // For now, let's require a turma or create one dynamically
          
          // Create a personal turma named "Atribuições Diretas - {student_name}"
          const { data: studentProfile } = await supabaseClient
            .from('profiles')
            .select('first_name')
            .eq('id', student_id)
            .single();

          const { data: personalTurma, error: turmaError } = await supabaseClient
            .from('turmas')
            .insert({
              nome: `Atribuições Diretas - ${studentProfile?.first_name || 'Aluno'}`,
              descricao: 'Turma automática para atribuições diretas',
              owner_teacher_id: user.id,
            })
            .select()
            .single();

          if (turmaError) {
            errors.push({ student_id, error: 'Erro ao criar turma pessoal' });
            continue;
          }

          turma_id = personalTurma.id;

          // Add student to this turma
          await supabaseClient
            .from('turma_membros')
            .insert({
              turma_id,
              user_id: student_id,
              role: 'aluno',
              ativo: true,
            });
        }

        // Now create the atribuicao
        const { data: atribuicao, error: atribError } = await supabaseClient
          .from('atribuicoes')
          .insert({
            turma_id,
            titulo,
            descricao,
            fonte_tipo,
            fonte_id,
            data_limite: data_limite || null,
            pontos_vale: pontos_vale || 50,
          })
          .select()
          .single();

        if (atribError) {
          errors.push({ student_id, error: 'Erro ao criar atribuição' });
          continue;
        }

        // Create status for this student
        const { error: statusError } = await supabaseClient
          .from('atribuicoes_status')
          .insert({
            atribuicao_id: atribuicao.id,
            aluno_id: student_id,
            status: 'pendente',
          });

        if (statusError) {
          errors.push({ student_id, error: 'Erro ao criar status de atribuição' });
          continue;
        }

        createdAssignments.push({ student_id, atribuicao_id: atribuicao.id });

      } catch (err) {
        console.error(`Error assigning to student ${student_id}:`, err);
        errors.push({ student_id, error: 'Erro inesperado' });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        created_count: createdAssignments.length,
        assignments: createdAssignments,
        errors: errors.length > 0 ? errors : undefined,
        message: 'Atribuição enviada.',
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
