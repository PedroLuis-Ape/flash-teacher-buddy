import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAssignmentThreadRequest {
  class_id: string;
  assignment_id: string;
  student_id: string;
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

    const payload: CreateAssignmentThreadRequest = await req.json();
    const { class_id, assignment_id, student_id } = payload;

    if (!class_id || !assignment_id || !student_id) {
      return new Response(
        JSON.stringify({ error: 'class_id, assignment_id e student_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é o aluno ou o professor
    const { data: classData } = await supabase
      .from('classes')
      .select('owner_id')
      .eq('id', class_id)
      .single();

    const isTeacher = classData?.owner_id === user.id;
    const isStudent = student_id === user.id;

    if (!isTeacher && !isStudent) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão nesta turma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar thread existente (idempotente)
    const { data: existingThread } = await supabase
      .from('threads')
      .select('*')
      .eq('assignment_id', assignment_id)
      .eq('student_id', student_id)
      .eq('type', 'assignment')
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

    // Criar nova thread (professor e aluno)
    const { data: newThread, error: insertError } = await supabase
      .from('threads')
      .insert({
        class_id,
        type: 'assignment',
        assignment_id,
        student_id,
        user_a_id: classData!.owner_id, // Professor
        user_b_id: student_id, // Aluno
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating assignment thread:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar thread' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Assignment thread created:', assignment_id, student_id);

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
