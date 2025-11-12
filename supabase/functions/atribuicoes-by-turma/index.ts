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

    // Read body first (for POST requests from invoke)
    let bodyData: any = {};
    if (req.method === 'POST') {
      try {
        bodyData = await req.json();
      } catch (_) {
        // ignore parse errors
      }
    }

    // Get params from body or querystring
    const url = new URL(req.url);
    const turma_id = bodyData?.turma_id || url.searchParams.get('turma_id');

    if (!turma_id) {
      return new Response(
        JSON.stringify({ error: 'turma_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar atribuições
    const { data: atribuicoes, error: atribuicoesError } = await supabaseClient
      .from('atribuicoes')
      .select('*')
      .eq('turma_id', turma_id)
      .order('created_at', { ascending: false });

    if (atribuicoesError) {
      console.error('Error fetching atribuições:', atribuicoesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar atribuições' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar total de alunos na turma
    const { count: totalAlunos } = await supabaseClient
      .from('turma_membros')
      .select('*', { count: 'exact', head: true })
      .eq('turma_id', turma_id)
      .eq('ativo', true);

    // Para cada atribuição, buscar estatísticas de progresso
    const atribuicoesComProgresso = await Promise.all(
      (atribuicoes || []).map(async (atrib) => {
        const { data: statusData } = await supabaseClient
          .from('atribuicoes_status')
          .select('status, aluno_id')
          .eq('atribuicao_id', atrib.id);

        const stats = {
          total_alunos: totalAlunos || 0,
          concluidas: (statusData || []).filter(s => s.status === 'concluida').length,
          em_andamento: (statusData || []).filter(s => s.status === 'em_andamento').length,
          pendentes: (totalAlunos || 0) - (statusData || []).length,
        };

        return {
          ...atrib,
          progresso: stats,
        };
      })
    );

    return new Response(
      JSON.stringify({ atribuicoes: atribuicoesComProgresso }),
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