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

    const body = await req.json();
    const { atribuicao_id } = body;

    if (!atribuicao_id) {
      return new Response(
        JSON.stringify({ error: 'ID da atribuição é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar a atribuição para verificar a turma
    const { data: atribuicao, error: atribError } = await supabaseClient
      .from('atribuicoes')
      .select('id, turma_id')
      .eq('id', atribuicao_id)
      .single();

    if (atribError || !atribuicao) {
      return new Response(
        JSON.stringify({ error: 'Atribuição não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário é dono da turma
    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', atribuicao.turma_id)
      .single();

    if (turmaError || !turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para deletar esta atribuição' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deletar status de atribuições dos alunos primeiro
    await supabaseClient
      .from('atribuicoes_status')
      .delete()
      .eq('atribuicao_id', atribuicao_id);

    // Deletar a atribuição
    const { error: deleteError } = await supabaseClient
      .from('atribuicoes')
      .delete()
      .eq('id', atribuicao_id);

    if (deleteError) {
      console.error('Error deleting atribuicao:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar atribuição' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atribuição deletada:', atribuicao_id);

    return new Response(
      JSON.stringify({ success: true }),
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
