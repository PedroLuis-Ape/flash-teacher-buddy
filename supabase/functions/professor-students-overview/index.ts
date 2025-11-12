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

    const url = new URL(req.url);
    const aluno_id = url.searchParams.get('aluno_id');

    if (!aluno_id) {
      return new Response(
        JSON.stringify({ error: 'aluno_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is teacher of this student or is the student themselves
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('student_id')
      .eq('teacher_id', user.id)
      .eq('student_id', aluno_id)
      .single();

    const isTeacherOfStudent = !!subscription;
    const isOwnProfile = user.id === aluno_id;

    if (!isTeacherOfStudent && !isOwnProfile) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para esta ação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get student profile
    const { data: studentProfile } = await supabaseClient
      .from('profiles')
      .select('id, first_name, ape_id, avatar_skin_id, level, xp_total, pts_weekly, balance_pitecoin')
      .eq('id', aluno_id)
      .single();

    // Get recent assignments
    const { data: assignments } = await supabaseClient
      .from('atribuicoes_status')
      .select(`
        id,
        status,
        concluida_em,
        atribuicao:atribuicao_id (
          id,
          titulo,
          descricao,
          data_limite,
          pontos_vale,
          turma:turma_id (
            id,
            nome
          )
        )
      `)
      .eq('aluno_id', aluno_id)
      .order('concluida_em', { ascending: false, nullsFirst: false })
      .limit(10);

    // Get common turmas if teacher
    let commonTurmas = [];
    if (isTeacherOfStudent) {
      const { data: turmasData } = await supabaseClient
        .from('turma_membros')
        .select(`
          turma:turma_id (
            id,
            nome,
            descricao
          )
        `)
        .eq('user_id', aluno_id)
        .eq('ativo', true);

      commonTurmas = turmasData?.map((t: any) => t.turma).filter(Boolean) || [];
    }

    // Get last DM message
    let lastDmMessage = null;
    if (isTeacherOfStudent) {
      const { data: dmPair } = await supabaseClient
        .from('dms')
        .select('id')
        .eq('teacher_id', user.id)
        .eq('aluno_id', aluno_id)
        .single();

      if (dmPair) {
        const { data: lastMsg } = await supabaseClient
          .from('mensagens')
          .select('texto, created_at, sender_id')
          .eq('thread_tipo', 'dm')
          .eq('thread_chave', dmPair.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        lastDmMessage = lastMsg;
      }
    }

    return new Response(
      JSON.stringify({ 
        student: studentProfile,
        assignments: assignments || [],
        commonTurmas,
        lastDmMessage,
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
