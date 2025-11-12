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

    const { turma_id, student_ids } = await req.json();

    if (!turma_id || !student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'turma_id e student_ids são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is the turma owner
    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    if (turmaError || !turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para esta ação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add students to turma (idempotent - ignore duplicates)
    const membersToAdd = student_ids.map(student_id => ({
      turma_id,
      user_id: student_id,
      role: 'aluno',
      ativo: true,
    }));

    const { data: addedMembers, error: addError } = await supabaseClient
      .from('turma_membros')
      .upsert(membersToAdd, { 
        onConflict: 'turma_id,user_id',
        ignoreDuplicates: true 
      })
      .select();

    if (addError) {
      console.error('Error adding students to class:', addError);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar alunos à turma' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        added_count: addedMembers?.length || 0,
        message: 'Alunos adicionados à turma.',
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
