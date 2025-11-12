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

    const { turma_id, titulo, descricao, fonte_tipo, fonte_id, data_limite, pontos_vale } = await req.json();

    if (!turma_id || !titulo || !fonte_tipo || !fonte_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is turma owner
    const { data: turma, error: turmaError } = await supabaseClient
      .from('turmas')
      .select('owner_teacher_id')
      .eq('id', turma_id)
      .single();

    if (turmaError || !turma || turma.owner_teacher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Turma não encontrada ou acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create atribuição
    const { data: atribuicao, error: insertError } = await supabaseClient
      .from('atribuicoes')
      .insert({
        turma_id,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        fonte_tipo,
        fonte_id,
        data_limite: data_limite || null,
        pontos_vale: pontos_vale || 50,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating atribuição:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar atribuição' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create status entries for all turma members
    const { data: members } = await supabaseClient
      .from('turma_membros')
      .select('user_id')
      .eq('turma_id', turma_id)
      .eq('ativo', true);

    if (members && members.length > 0) {
      const statusEntries = members.map(m => ({
        atribuicao_id: atribuicao.id,
        aluno_id: m.user_id,
        status: 'pendente',
        progresso: 0,
      }));

      await supabaseClient
        .from('atribuicoes_status')
        .insert(statusEntries);
    }

    return new Response(
      JSON.stringify({ atribuicao }),
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