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
    const atribuicao_id = url.searchParams.get('atribuicao_id');

    if (!atribuicao_id) {
      return new Response(
        JSON.stringify({ error: 'atribuicao_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário é dono da turma
    const { data: atribuicao } = await supabaseClient
      .from('atribuicoes')
      .select('turma_id')
      .eq('id', atribuicao_id)
      .single();

    if (!atribuicao) {
      return new Response(
        JSON.stringify({ error: 'Atribuição não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: turma } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', atribuicao.turma_id)
      .single();

    if (!turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para visualizar progresso' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os alunos da turma
    const { data: membros } = await supabaseClient
      .from('turma_membros')
      .select('user_id')
      .eq('turma_id', atribuicao.turma_id)
      .eq('ativo', true);

    const alunoIds = (membros || []).map(m => m.user_id);

    // Buscar perfis dos alunos
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, first_name, avatar_skin_id')
      .in('id', alunoIds);

    // Buscar status de cada aluno
    const { data: statusData } = await supabaseClient
      .from('atribuicoes_status')
      .select('*')
      .eq('atribuicao_id', atribuicao_id)
      .in('aluno_id', alunoIds);

    // Mapear status por aluno
    const statusMap = new Map((statusData || []).map(s => [s.aluno_id, s]));

    // Montar lista de progresso
    const progresso = (profiles || []).map(profile => {
      const status = statusMap.get(profile.id) || {
        status: 'pendente',
        progresso: 0,
        updated_at: null,
      };

      return {
        aluno_id: profile.id,
        aluno_nome: profile.first_name,
        avatar_skin_id: profile.avatar_skin_id,
        status: status.status,
        progresso: status.progresso,
        ultima_atualizacao: status.updated_at,
      };
    });

    return new Response(
      JSON.stringify({ progresso }),
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
